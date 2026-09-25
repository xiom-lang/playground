// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// xiom-sandbox: a small Landlock wrapper for the playground compiler.
//
// The playground container executes arbitrary submitted programs as the
// same uid as the server, so filesystem and network access must be limited
// by the kernel, not by convention. This helper applies a Landlock policy
// to itself and then execs the target; Landlock rules survive execve, so
// the compiler driver, clang, the linker and the produced program (and
// anything they spawn) all inherit the same confinement.
//
// Policy (deny by default):
//   read-write: /tmp (work dirs, script cache, HOME under /tmp)
//   read+exec:  /usr /bin /sbin /lib /lib64 /app /toolchain
//   read:       /etc/ld.so.cache, /dev/zero, /dev/urandom
//   read-write: /dev/null
//   denied:     everything else, including /data, /proc, /sys and the rest
//               of /dev; TCP connect and bind are denied on ABI >= 4.
//
// Usage:
//   xiom-sandbox --probe                print ABI and restrict_self result
//   xiom-sandbox -- CMD [ARG...]        apply the policy, exec CMD
//   xiom-sandbox ARG...                 exec $XIOM_SANDBOX_TARGET (or xiom)
//
// Exit codes: 0 ok; 2 usage; 125 policy application failed; 126 Landlock
// unavailable; 127 exec failed.

#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

typedef unsigned char u8;
typedef signed int s32;
typedef unsigned int u32;
typedef unsigned long long u64;

/* Landlock UAPI (stable; defined here so the build never depends on
 * distro kernel headers). */
struct landlock_ruleset_attr {
  u64 handled_access_fs;
  u64 handled_access_net;
};

struct landlock_path_beneath_attr {
  u64 allowed_access;
  s32 parent_fd;
} __attribute__((packed));

struct landlock_net_port_attr {
  u64 allowed_access;
  u64 port;
};

#define LANDLOCK_CREATE_RULESET_VERSION (1U << 0)
#define LANDLOCK_RULE_PATH_BENEATH 1
#define LANDLOCK_RULE_NET_PORT 2

#define LL_FS_EXECUTE (1ULL << 0)
#define LL_FS_WRITE_FILE (1ULL << 1)
#define LL_FS_READ_FILE (1ULL << 2)
#define LL_FS_READ_DIR (1ULL << 3)
#define LL_FS_REMOVE_DIR (1ULL << 4)
#define LL_FS_REMOVE_FILE (1ULL << 5)
#define LL_FS_MAKE_CHAR (1ULL << 6)
#define LL_FS_MAKE_DIR (1ULL << 7)
#define LL_FS_MAKE_REG (1ULL << 8)
#define LL_FS_MAKE_SOCK (1ULL << 9)
#define LL_FS_MAKE_FIFO (1ULL << 10)
#define LL_FS_MAKE_BLOCK (1ULL << 11)
#define LL_FS_MAKE_SYM (1ULL << 12)
#define LL_FS_REFER (1ULL << 13)     /* ABI >= 2 */
#define LL_FS_TRUNCATE (1ULL << 14)  /* ABI >= 3 */

#define LL_NET_BIND_TCP (1ULL << 0)     /* ABI >= 4 */
#define LL_NET_CONNECT_TCP (1ULL << 1)  /* ABI >= 4 */

#ifndef SYS_landlock_create_ruleset
#define SYS_landlock_create_ruleset 444
#endif
#ifndef SYS_landlock_add_rule
#define SYS_landlock_add_rule 445
#endif
#ifndef SYS_landlock_restrict_self
#define SYS_landlock_restrict_self 446
#endif

#define EXIT_POLICY 125
#define EXIT_NO_LANDLOCK 126
#define EXIT_EXEC 127

static int landlock_abi(void) {
  long ret = syscall(SYS_landlock_create_ruleset, NULL, 0,
                     LANDLOCK_CREATE_RULESET_VERSION);
  return ret < 0 ? -1 : (int)ret;
}

static int allow_path(int ruleset_fd, const char *path, u64 access, int required) {
  int fd = open(path, O_PATH | O_CLOEXEC);
  if (fd < 0) {
    if (required) {
      fprintf(stderr, "xiom-sandbox: cannot open %s: %s\n", path, strerror(errno));
      return -1;
    }
    return 0;
  }
  struct landlock_path_beneath_attr rule;
  rule.allowed_access = access;
  rule.parent_fd = fd;
  int ret = syscall(SYS_landlock_add_rule, ruleset_fd, LANDLOCK_RULE_PATH_BENEATH,
                    &rule, 0);
  close(fd);
  if (ret < 0) {
    fprintf(stderr, "xiom-sandbox: cannot add rule for %s: %s\n", path,
            strerror(errno));
    return -1;
  }
  return 0;
}

/* Build and apply the policy. Returns 0 or an EXIT_* code. */
static int apply_policy(void) {
  int abi = landlock_abi();
  if (abi < 1) return EXIT_NO_LANDLOCK;

  u64 fs = LL_FS_EXECUTE | LL_FS_WRITE_FILE | LL_FS_READ_FILE |
           LL_FS_READ_DIR | LL_FS_REMOVE_DIR | LL_FS_REMOVE_FILE |
           LL_FS_MAKE_CHAR | LL_FS_MAKE_DIR | LL_FS_MAKE_REG |
           LL_FS_MAKE_SOCK | LL_FS_MAKE_FIFO | LL_FS_MAKE_BLOCK |
           LL_FS_MAKE_SYM;
  if (abi >= 2) fs |= LL_FS_REFER;
  if (abi >= 3) fs |= LL_FS_TRUNCATE;

  struct landlock_ruleset_attr attr;
  memset(&attr, 0, sizeof(attr));
  attr.handled_access_fs = fs;
  u64 net = 0;
  size_t attr_size = sizeof(u64); /* pre-ABI-4 kernels have no net field */
  if (abi >= 4) {
    net = LL_NET_BIND_TCP | LL_NET_CONNECT_TCP;
    attr.handled_access_net = net;
    attr_size = sizeof(attr);
  }

  int ruleset_fd = (int)syscall(SYS_landlock_create_ruleset, &attr, attr_size, 0);
  if (ruleset_fd < 0) return EXIT_POLICY;

  const u64 ro = LL_FS_READ_FILE | LL_FS_READ_DIR | LL_FS_EXECUTE;
  const u64 ro_file = LL_FS_READ_FILE;
  const u64 rw = fs;

  if (allow_path(ruleset_fd, "/tmp", rw, 1) != 0) return EXIT_POLICY;

  /* Loader and compiler runtime. Optional paths differ per distribution. */
  if (allow_path(ruleset_fd, "/usr", ro, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/bin", ro, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/sbin", ro, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/lib", ro, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/lib64", ro, 0) != 0) return EXIT_POLICY;

  /* Application and toolchain, read-only. */
  if (allow_path(ruleset_fd, "/app", ro, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/toolchain", ro, 0) != 0) return EXIT_POLICY;

  /* Dynamic loader cache and the minimal device set. */
  if (allow_path(ruleset_fd, "/etc/ld.so.cache", ro_file, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/dev/null", LL_FS_READ_FILE | LL_FS_WRITE_FILE, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/dev/zero", ro_file, 0) != 0) return EXIT_POLICY;
  if (allow_path(ruleset_fd, "/dev/urandom", ro_file, 0) != 0) return EXIT_POLICY;

  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) return EXIT_POLICY;
  if (syscall(SYS_landlock_restrict_self, ruleset_fd, 0) != 0) return EXIT_POLICY;
  close(ruleset_fd);
  (void)net;
  return 0;
}

static void print_probe(int abi, int code) {
  if (code == 0) {
    printf("{\"landlock_abi\":%d,\"restrict_self\":\"ok\"}\n", abi);
  } else {
    printf("{\"landlock_abi\":%d,\"restrict_self\":\"fail\",\"error\":%d}\n",
           abi, code);
  }
}

int main(int argc, char **argv) {
  if (argc >= 2 && strcmp(argv[1], "--probe") == 0) {
    int abi = landlock_abi();
    int code = abi < 1 ? EXIT_NO_LANDLOCK : apply_policy();
    print_probe(abi, code);
    return code;
  }

  char **exec_argv = NULL;
  if (argc >= 2 && strcmp(argv[1], "--") == 0) {
    if (argc < 3) {
      fprintf(stderr, "xiom-sandbox: missing command after --\n");
      return 2;
    }
    exec_argv = &argv[2];
  } else {
    /* Env-target mode for the tools and the audit: XIOM_BIN=this binary
     * plus XIOM_SANDBOX_TARGET=<compiler>. */
    const char *target = getenv("XIOM_SANDBOX_TARGET");
    if (!target || !*target) target = "xiom";
    char **wrapped = calloc((size_t)argc + 1, sizeof(char *));
    if (!wrapped) return 2;
    wrapped[0] = (char *)target;
    for (int i = 1; i < argc; i++) wrapped[i] = argv[i];
    wrapped[argc] = NULL;
    exec_argv = wrapped;
  }

  int code = apply_policy();
  if (code != 0) {
    if (code == EXIT_NO_LANDLOCK) {
      fprintf(stderr, "xiom-sandbox: Landlock unavailable (kernel too old?)\n");
    } else {
      fprintf(stderr, "xiom-sandbox: cannot apply the Landlock policy\n");
    }
    return code;
  }
  execvp(exec_argv[0], exec_argv);
  fprintf(stderr, "xiom-sandbox: cannot exec %s: %s\n", exec_argv[0],
          strerror(errno));
  return EXIT_EXEC;
}
