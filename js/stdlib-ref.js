 // XIOM Standard Library Reference - v0.58.0
// ★ = fully WASM-compatible   ⚠ = limited in WASM   ✗ = not available in WASM

var stdlibData = {
  modules: [
    {
      name: "core",
      desc: "Built-in types and interfaces - always available, no import needed",
      wasm: "★",
      functions: [
        { sig: "Option[T]", desc: "Some(value) | None - no null" },
        { sig: "Result[T, E]", desc: "Ok(value) | Err(error) - no exceptions" },
        { sig: "Box[T]", desc: "Heap-allocated owned pointer" },
        { sig: "BinaryHeap[T]", desc: "Priority queue (max-heap)" },
        { sig: "Cow[T]", desc: "Clone-on-write smart pointer" },
        { sig: "PhantomData[T]", desc: "Zero-size type marker" },
        { sig: "MaybeUninit[T]", desc: "Uninitialized memory container" },
        { sig: "panic(msg: Str)", desc: "Crash with message" },
        { sig: "assert(condition: Bool, msg: Str)", desc: "Runtime assertion" },
        { sig: "panic_if(condition: Bool, msg: Str)", desc: "Conditional panic" },
        { sig: "size_of[T]() -> Int", desc: "Size in bytes (compiler intrinsic)" },
        { sig: "align_of[T]() -> Int", desc: "Alignment in bytes (compiler intrinsic)" },
        { sig: "to_int(x: Float64) -> Int", desc: "Float64 -> Int (truncates)" },
        { sig: "to_float(x: Int) -> Float64", desc: "Int -> Float64" },
        { sig: "to_string(x: Int) -> Str", desc: "Int -> Str" },
        { sig: "to_int_from_str(s: Str) -> Result[Int, Str]", desc: "Str -> Int" },
        { sig: "to_float_from_str(s: Str) -> Result[Float64, Str]", desc: "Str -> Float64" },
        { sig: "to_bool_from_str(s: Str) -> Result[Bool, Str]", desc: "Str -> Bool" },
        { sig: "to_char(x: Int) -> Char", desc: "Int -> Char" },
        { sig: "to_int_from_char(c: Char) -> Int", desc: "Char -> Int" },
        { sig: "is_sorted[T: Ord](items: &Slice[T]) -> Bool", desc: "Elements non-decreasing" },
        { sig: "all[T](items: &Slice[T], f: fn(T) -> Bool) -> Bool", desc: "All satisfy predicate" },
        { sig: "none[T](items: &Slice[T], f: fn(T) -> Bool) -> Bool", desc: "None satisfy predicate" },
        { sig: "contains[T: Eq](items: &Slice[T], value: T) -> Bool", desc: "Collection contains value" },
        // Option methods
        { sig: "Option[T].unwrap_or(self, default: T) -> T", desc: "Unwrap with default" },
        { sig: "Option[T].unwrap_or_else(self, f: fn() -> T) -> T", desc: "Unwrap with lazy default" },
        { sig: "Option[T].map[U](self, f: fn(T) -> U) -> Option[U]", desc: "Transform inner value" },
        { sig: "Option[T].and_then[U](self, f: fn(T) -> Option[U]) -> Option[U]", desc: "Flat-map / chain" },
        { sig: "Option[T].filter(self, pred: fn(&T) -> Bool) -> Option[T]", desc: "Filter by predicate" },
        { sig: "Option[T].is_some_and(self, pred: fn(&T) -> Bool) -> Bool", desc: "Check + test predicate" },
        // Result methods
        { sig: "Result[T,E].unwrap_or(self, default: T) -> T", desc: "Unwrap with default" },
        { sig: "Result[T,E].unwrap_or_else(self, f: fn(E) -> T) -> T", desc: "Unwrap with lazy default" },
        { sig: "Result[T,E].map[U](self, f: fn(T) -> U) -> Result[U,E]", desc: "Transform Ok value" },
        { sig: "Result[T,E].map_err[F](self, f: fn(E) -> F) -> Result[T,F]", desc: "Transform Err value" },
        { sig: "Result[T,E].and_then[U](self, f: fn(T) -> Result[U,E]) -> Result[U,E]", desc: "Flat-map Ok" },
        { sig: "Result[T,E].expect(self, msg: Str) -> T", desc: "Unwrap or panic with message" },
        { sig: "Result[T,E].is_ok_and(self, pred: fn(&T) -> Bool) -> Bool", desc: "Check Ok + test predicate" },
        // Box & BinaryHeap
        { sig: "Box.new[T](value: T) -> Box[T]", desc: "Allocate on heap" },
        { sig: "Box.get[T](b: &Box[T]) -> &T", desc: "Get reference to inner value" },
        { sig: "Box.drop[T](b: Box[T])", desc: "Explicit drop" },
        { sig: "BinaryHeap[T:Ord].new() -> BinaryHeap[T]", desc: "Create max-heap" },
        { sig: "BinaryHeap[T:Ord].push(self, value: T)", desc: "Insert element" },
        { sig: "BinaryHeap[T:Ord].pop(self) -> Option[T]", desc: "Remove max element" },
        { sig: "BinaryHeap[T:Ord].peek(self) -> Option[T]", desc: "View max element" },
        { sig: "BinaryHeap[T].len(self) -> Int", desc: "Element count" },
        { sig: "BinaryHeap[T].is_empty(self) -> Bool", desc: "Check if empty" },
        // Constants
        { sig: "INT_MAX: Int = 9223372036854775807", desc: "Maximum Int value" },
        { sig: "INT_MIN: Int = -9223372036854775808", desc: "Minimum Int value" },
        { sig: "FLOAT64_MAX: Float64 = 1.79e308", desc: "Maximum Float64 value" },
        { sig: "FLOAT64_MIN: Float64 = 2.23e-308", desc: "Minimum positive Float64" },
        { sig: "FLOAT64_EPSILON: Float64 = 2.22e-16", desc: "Machine epsilon" },
        // Core interfaces
        { sig: "interface Clone", desc: "fn clone() -> Self" },
        { sig: "interface Eq", desc: "fn eq(other: &Self) -> Bool" },
        { sig: "interface Ord", desc: "fn compare(other: &Self) -> Int (-1,0,1)" },
        { sig: "interface Display", desc: "fn to_str() -> Str" },
        { sig: "interface Hash", desc: "fn hash() -> UInt64" },
        { sig: "interface Default", desc: "fn default() -> Self" },
        { sig: "interface Drop", desc: "fn drop(self)" },
        { sig: "interface Debug", desc: "fn fmt(self, f: &mut Formatter)" },
        { sig: "interface Deref", desc: "fn deref(self) -> &Self.Target" },
        { sig: "interface AsRef[T]", desc: "fn as_ref(self) -> &T" },
      ]
    },
    {
      name: "collections",
      desc: "Vec, Map, Set, LinkedList, Queue, Stack, VecDeque, BTreeMap, BTreeSet, Slice",
      wasm: "★",
      functions: [
        // Vec
        { sig: "Vec.new[T]() -> Vec[T]", desc: "Create empty vector" },
        { sig: "Vec.with_capacity[T](cap: Int) -> Vec[T]", desc: "Create with pre-allocated capacity" },
        { sig: "Vec.push[T](value: T)", desc: "Append to end" },
        { sig: "Vec.pop[T]() -> Option[T]", desc: "Remove from end" },
        { sig: "Vec.get[T](index: Int) -> Option[T]", desc: "Safe indexed access" },
        { sig: "Vec.len[T]() -> Int", desc: "Number of elements" },
        { sig: "Vec.is_empty[T]() -> Bool", desc: "Check if empty" },
        { sig: "Vec.clear[T]()", desc: "Remove all elements" },
        { sig: "Vec.insert[T](index: Int, value: T)", desc: "Insert at position" },
        { sig: "Vec.remove[T](index: Int) -> Option[T]", desc: "Remove at position" },
        { sig: "Vec.first[T]() -> Option[T]", desc: "First element" },
        { sig: "Vec.last[T]() -> Option[T]", desc: "Last element" },
        { sig: "Vec.set[T](index: Int, value: T)", desc: "Set element at index" },
        // Map
        { sig: "Map.new[K,V]() -> Map[K,V]", desc: "Create empty hash map" },
        { sig: "Map.insert[K,V](key: K, value: V)", desc: "Insert key-value pair" },
        { sig: "Map.get[K,V](key: &K) -> Option[V]", desc: "Look up by key" },
        { sig: "Map.remove[K,V](key: &K) -> Option[V]", desc: "Remove by key" },
        { sig: "Map.contains[K,V](key: &K) -> Bool", desc: "Check key existence" },
        { sig: "Map.len[K,V]() -> Int", desc: "Number of entries" },
        { sig: "Map.keys[K,V]() -> Vec[K]", desc: "Get all keys" },
        { sig: "Map.values[K,V]() -> Vec[V]", desc: "Get all values" },
        { sig: "Map.clear[K,V]()", desc: "Remove all entries" },
        // Set
        { sig: "Set.new[T]() -> Set[T]", desc: "Create empty hash set" },
        { sig: "Set.insert[T](value: T)", desc: "Add value" },
        { sig: "Set.remove[T](value: &T)", desc: "Remove value" },
        { sig: "Set.contains[T](value: &T) -> Bool", desc: "Check membership" },
        { sig: "Set.len[T]() -> Int", desc: "Number of elements" },
        { sig: "Set.union[T](other: &Set[T]) -> Set[T]", desc: "Union of two sets" },
        { sig: "Set.intersection[T](other: &Set[T]) -> Set[T]", desc: "Intersection of two sets" },
        { sig: "Set.difference[T](other: &Set[T]) -> Set[T]", desc: "Difference of two sets" },
        // LinkedList
        { sig: "LinkedList.new[T]() -> LinkedList[T]", desc: "Create empty linked list" },
        { sig: "LinkedList.push_front[T](value: T)", desc: "Add to front" },
        { sig: "LinkedList.push_back[T](value: T)", desc: "Add to back" },
        { sig: "LinkedList.pop_front[T]() -> Option[T]", desc: "Remove from front" },
        { sig: "LinkedList.pop_back[T]() -> Option[T]", desc: "Remove from back" },
        { sig: "LinkedList.len[T]() -> Int", desc: "Number of nodes" },
        { sig: "LinkedList.is_empty[T]() -> Bool", desc: "Check if empty" },
        // Queue
        { sig: "Queue.new[T]() -> Queue[T]", desc: "Create empty FIFO queue" },
        { sig: "Queue.enqueue[T](value: T)", desc: "Add to back" },
        { sig: "Queue.dequeue[T]() -> Option[T]", desc: "Remove from front" },
        { sig: "Queue.peek[T]() -> Option[T]", desc: "View front without removing" },
        { sig: "Queue.len[T]() -> Int", desc: "Number of elements" },
        { sig: "Queue.is_empty[T]() -> Bool", desc: "Check if empty" },
        // Stack
        { sig: "Stack.new[T]() -> Stack[T]", desc: "Create empty LIFO stack" },
        { sig: "Stack.push[T](value: T)", desc: "Push onto top" },
        { sig: "Stack.pop[T]() -> Option[T]", desc: "Pop from top" },
        { sig: "Stack.peek[T]() -> Option[T]", desc: "View top without removing" },
        { sig: "Stack.len[T]() -> Int", desc: "Number of elements" },
        { sig: "Stack.is_empty[T]() -> Bool", desc: "Check if empty" },
        // VecDeque
        { sig: "VecDeque.new[T]() -> VecDeque[T]", desc: "Create empty double-ended queue" },
        { sig: "VecDeque.with_capacity[T](cap: Int) -> VecDeque[T]", desc: "Create with capacity" },
        { sig: "VecDeque.push_front[T](value: T)", desc: "Add to front" },
        { sig: "VecDeque.push_back[T](value: T)", desc: "Add to back" },
        { sig: "VecDeque.pop_front[T]() -> Option[T]", desc: "Remove from front" },
        { sig: "VecDeque.pop_back[T]() -> Option[T]", desc: "Remove from back" },
        { sig: "VecDeque.front[T]() -> Option[T]", desc: "View front element" },
        { sig: "VecDeque.back[T]() -> Option[T]", desc: "View back element" },
        { sig: "VecDeque.len[T]() -> Int", desc: "Number of elements" },
        // BTreeMap
        { sig: "BTreeMap.new[K:Ord,V]() -> BTreeMap[K,V]", desc: "Create empty sorted map" },
        { sig: "BTreeMap.insert[K:Ord,V](key: K, value: V) -> Option[V]", desc: "Insert sorted entry" },
        { sig: "BTreeMap.get[K:Ord,V](key: &K) -> Option[V]", desc: "Binary search lookup" },
        { sig: "BTreeMap.remove[K:Ord,V](key: &K) -> Option[V]", desc: "Remove by key" },
        { sig: "BTreeMap.contains_key[K:Ord,V](key: &K) -> Bool", desc: "Check key existence" },
        { sig: "BTreeMap.first_entry[K:Ord,V]() -> Option[(K,V)]", desc: "Smallest entry" },
        { sig: "BTreeMap.last_entry[K:Ord,V]() -> Option[(K,V)]", desc: "Largest entry" },
        { sig: "BTreeMap.len[K:Ord,V]() -> Int", desc: "Number of entries" },
        // BTreeSet
        { sig: "BTreeSet.new[T:Ord]() -> BTreeSet[T]", desc: "Create empty sorted set" },
        { sig: "BTreeSet.insert[T:Ord](value: T) -> Bool", desc: "Insert sorted value" },
        { sig: "BTreeSet.remove[T:Ord](value: &T) -> Bool", desc: "Remove value" },
        { sig: "BTreeSet.contains[T:Ord](value: &T) -> Bool", desc: "Binary search check" },
        { sig: "BTreeSet.first[T:Ord]() -> Option[T]", desc: "Smallest element" },
        { sig: "BTreeSet.last[T:Ord]() -> Option[T]", desc: "Largest element" },
        { sig: "BTreeSet.len[T:Ord]() -> Int", desc: "Number of elements" },
        // Slice
        { sig: "Slice.len[T]() -> Int", desc: "Number of elements" },
        { sig: "Slice.is_empty[T]() -> Bool", desc: "Check if empty" },
        { sig: "Slice.first[T]() -> Option[T]", desc: "First element" },
        { sig: "Slice.last[T]() -> Option[T]", desc: "Last element" },
        { sig: "Slice.get[T](index: Int) -> Option[T]", desc: "Safe indexed access" },
      ]
    },
    {
      name: "string",
      desc: "UTF-8 string operations",
      wasm: "★",
      functions: [
        { sig: "string.str_len(s: Str) -> Int", desc: "Character count" },
        { sig: "string.str_concat(a: Str, b: Str) -> Str", desc: "Concatenate two strings" },
        { sig: "string.str_slice(s: Str, start: Int, end: Int) -> Str", desc: "Substring by byte range" },
        { sig: "string.str_contains(s: Str, sub: Str) -> Bool", desc: "Check for substring" },
        { sig: "string.str_starts_with(s: Str, prefix: Str) -> Bool", desc: "Check prefix" },
        { sig: "string.str_ends_with(s: Str, suffix: Str) -> Bool", desc: "Check suffix" },
        { sig: "string.str_split(s: Str, delim: Str) -> Vec[Str]", desc: "Split by delimiter" },
        { sig: "string.str_trim(s: Str) -> Str", desc: "Trim whitespace" },
        { sig: "string.str_to_int(s: Str) -> Result[Int, Str]", desc: "Parse integer" },
        { sig: "string.str_to_float(s: Str) -> Result[Float64, Str]", desc: "Parse float" },
        { sig: "string.str_upper(s: Str) -> Str", desc: "Convert to uppercase" },
        { sig: "string.str_lower(s: Str) -> Str", desc: "Convert to lowercase" },
        { sig: "string.format(fmt: Str) -> Str", desc: "Format string (no args)" },
        { sig: "string.format1(fmt: Str, arg: Str) -> Str", desc: "Format with one arg" },
        { sig: "string.format2(fmt: Str, a1: Str, a2: Str) -> Str", desc: "Format with two args" },
        { sig: "string.char_at(s: Str, pos: Int) -> Option[Char]", desc: "Get character at position" },
        { sig: "string.index_of(s: Str, sub: Str) -> Option[Int]", desc: "Find first position" },
        { sig: "string.last_index_of(s: Str, sub: Str) -> Option[Int]", desc: "Find last position" },
        { sig: "string.replace(s: Str, from: Str, to: Str) -> Str", desc: "Replace all occurrences" },
        { sig: "string.lines(s: Str) -> Vec[Str]", desc: "Split into lines" },
        { sig: "string.words(s: Str) -> Vec[Str]", desc: "Split into words" },
        { sig: "string.is_empty(s: Str) -> Bool", desc: "Check if empty string" },
        { sig: "string.char_count(s: Str) -> Int", desc: "Unicode character count" },
        { sig: "string.byte_count(s: Str) -> Int", desc: "Byte count (UTF-8)" },
      ]
    },
    {
      name: "io",
      desc: "Console output, files, process, buffered I/O",
      wasm: "⚠",
      functions: [
        { sig: "io.print(msg: Str)", desc: "Print to stdout", wasm: "★" },
        { sig: "io.println(msg: Str)", desc: "Print line to stdout", wasm: "★" },
        { sig: "io.print_line(s: Str)", desc: "Print line (alias)", wasm: "★" },
        { sig: "io.read_line() -> Str", desc: "Read line from stdin", wasm: "✗" },
        { sig: "io.read_int() -> Result[Int, Str]", desc: "Read integer from stdin", wasm: "✗" },
        { sig: "io.read_float() -> Result[Float64, Str]", desc: "Read float from stdin", wasm: "✗" },
        { sig: "io.stdin() -> Int", desc: "Get stdin file descriptor", wasm: "✗" },
        { sig: "io.stdout() -> Int", desc: "Get stdout file descriptor", wasm: "★" },
        { sig: "io.stderr() -> Int", desc: "Get stderr file descriptor", wasm: "★" },
        { sig: "io.read_file(path: Str) -> Result[Str, IOError]", desc: "Read entire file", wasm: "✗" },
        { sig: "io.write_file(path: Str, c: Str) -> Result[Unit, IOError]", desc: "Write file", wasm: "✗" },
        { sig: "io.append_file(path: Str, c: Str) -> Result[Unit, IOError]", desc: "Append to file", wasm: "✗" },
        { sig: "io.file_exists(path: Str) -> Bool", desc: "Check if file exists", wasm: "✗" },
        { sig: "io.is_dir(path: Str) -> Bool", desc: "Check if path is directory", wasm: "✗" },
        { sig: "io.create_dir(path: Str) -> Result[Unit, IOError]", desc: "Create directory", wasm: "✗" },
        { sig: "io.list_dir(path: Str) -> Result[Vec[Str], IOError]", desc: "List directory contents", wasm: "✗" },
        { sig: "io.remove_file(path: Str) -> Result[Unit, IOError]", desc: "Delete file", wasm: "✗" },
        { sig: "io.copy_file(src: Str, dst: Str) -> Result[Unit, IOError]", desc: "Copy file", wasm: "✗" },
        { sig: "io.rename(src: Str, dst: Str) -> Result[Unit, IOError]", desc: "Rename/move file", wasm: "✗" },
        { sig: "io.metadata(path: Str) -> Result[Metadata, IOError]", desc: "Get file metadata", wasm: "✗" },
        { sig: "io.set_permissions(p: Str, perm: Int) -> Result[Unit, IOError]", desc: "Set file permissions", wasm: "✗" },
        { sig: "io.exit(code: Int)", desc: "Exit process", wasm: "✗" },
        { sig: "io.args() -> Vec[Str]", desc: "Command-line arguments", wasm: "✗" },
        { sig: "io.env_var(name: Str) -> Option[Str]", desc: "Get environment variable", wasm: "⚠" },
        { sig: "io.time_now() -> Int", desc: "Current time as integer", wasm: "⚠" },
        { sig: "io.sleep(ms: Int)", desc: "Sleep milliseconds", wasm: "✗" },
        { sig: "io.join_paths(base: Str, child: Str) -> Str", desc: "Join path components", wasm: "★" },
        { sig: "io.parent_path(path: Str) -> Option[Str]", desc: "Parent directory path", wasm: "★" },
        { sig: "io.file_name(path: Str) -> Option[Str]", desc: "File name from path", wasm: "★" },
        { sig: "io.extension(path: Str) -> Option[Str]", desc: "File extension", wasm: "★" },
        { sig: "io.is_absolute(path: Str) -> Bool", desc: "Check if absolute path", wasm: "★" },
        { sig: "BufReader.new(reader: Int) -> BufReader", desc: "Create buffered reader", wasm: "★" },
        { sig: "BufReader.read_line(self, buf: &mut Str) -> Result[Int, IOError]", desc: "Read buffered line", wasm: "★" },
        { sig: "BufReader.lines(self) -> Vec[Str]", desc: "Read all lines", wasm: "★" },
        { sig: "BufWriter.new(writer: Int) -> BufWriter", desc: "Create buffered writer", wasm: "★" },
        { sig: "Cursor.new(data: Vec[UInt8]) -> Cursor", desc: "Create in-memory cursor", wasm: "★" },
        { sig: "Cursor.into_inner(self) -> Vec[UInt8]", desc: "Extract inner data", wasm: "★" },
        { sig: "interface Read", desc: "read, read_to_end, read_to_string, read_exact", wasm: "★" },
        { sig: "interface Write", desc: "write, write_all, flush", wasm: "★" },
        { sig: "interface Seek", desc: "seek, stream_position", wasm: "★" },
      ]
    },
    {
      name: "fmt",
      desc: "String formatting with {} placeholders and Display interface",
      wasm: "★",
      functions: [
        { sig: "interface Display", desc: "fn fmt(self, f: &mut Formatter) -> Result[Unit, FmtError]" },
        { sig: "Formatter.new() -> Formatter", desc: "Create formatter" },
        { sig: "Formatter.write_str(self, s: Str) -> Result[Unit, FmtError]", desc: "Write string" },
        { sig: "Formatter.write_int(self, n: Int) -> Result[Unit, FmtError]", desc: "Write integer" },
        { sig: "Formatter.write_float(self, f: Float64) -> Result[Unit, FmtError]", desc: "Write float" },
        { sig: "Formatter.write_bool(self, b: Bool) -> Result[Unit, FmtError]", desc: "Write boolean" },
        { sig: "Formatter.finish(self) -> Str", desc: "Finalize and return string" },
        { sig: "Int.to_str() -> Str", desc: "Int -> String" },
        { sig: "Float64.to_str() -> Str", desc: "Float64 -> String" },
        { sig: "Bool.to_str() -> Str", desc: "Bool -> String" },
        { sig: "Str.to_str() -> Str", desc: "Str -> Str (identity)" },
        { sig: "fmt.format1[T](fmt: Str, arg: T) -> Str", desc: "Format single value ({})" },
        { sig: "fmt.format2[T,U](fmt: Str, a1: T, a2: U) -> Str", desc: "Format two values" },
        { sig: "fmt.format3[T,U,V](fmt: Str, a1: T, a2: U, a3: V) -> Str", desc: "Format three values" },
        { sig: "fmt.print(s: Str)", desc: "Print to stdout" },
        { sig: "fmt.println(s: Str)", desc: "Print line to stdout" },
      ]
    },
    {
      name: "math",
      desc: "Math functions, constants, and pure-XIOM fallbacks (*_pure)",
      wasm: "★",
      functions: [
        { sig: "math.PI: Float64", desc: "pi = 3.141592653589793" },
        { sig: "math.E: Float64", desc: "e = 2.718281828459045" },
        { sig: "math.TAU: Float64", desc: "tau = 2pi = 6.283185307179586" },
        { sig: "math.sqrt(x: Float64) -> Float64", desc: "Square root" },
        { sig: "math.pow(base: Float64, exp: Float64) -> Float64", desc: "Exponentiation" },
        { sig: "math.abs_int(x: Int) -> Int", desc: "Absolute value (int)" },
        { sig: "math.abs_float(x: Float64) -> Float64", desc: "Absolute value (float)" },
        { sig: "math.min_int(a: Int, b: Int) -> Int", desc: "Minimum of two ints" },
        { sig: "math.max_int(a: Int, b: Int) -> Int", desc: "Maximum of two ints" },
        { sig: "math.min_float(a: Float64, b: Float64) -> Float64", desc: "Minimum of two floats" },
        { sig: "math.max_float(a: Float64, b: Float64) -> Float64", desc: "Maximum of two floats" },
        { sig: "math.floor(x: Float64) -> Float64", desc: "Round down" },
        { sig: "math.ceil(x: Float64) -> Float64", desc: "Round up" },
        { sig: "math.round(x: Float64) -> Int", desc: "Round to nearest integer" },
        { sig: "math.sin(x: Float64) -> Float64", desc: "Sine" },
        { sig: "math.cos(x: Float64) -> Float64", desc: "Cosine" },
        { sig: "math.tan(x: Float64) -> Float64", desc: "Tangent" },
        { sig: "math.asin(x: Float64) -> Float64", desc: "Arc sine" },
        { sig: "math.acos(x: Float64) -> Float64", desc: "Arc cosine" },
        { sig: "math.atan(x: Float64) -> Float64", desc: "Arc tangent" },
        { sig: "math.atan2(y: Float64, x: Float64) -> Float64", desc: "2-argument arc tangent" },
        { sig: "math.exp(x: Float64) -> Float64", desc: "e^x" },
        { sig: "math.ln(x: Float64) -> Float64", desc: "Natural logarithm" },
        { sig: "math.log10(x: Float64) -> Float64", desc: "Base-10 logarithm" },
        { sig: "math.log2(x: Float64) -> Float64", desc: "Base-2 logarithm" },
        { sig: "math.bit_and(a: Int, b: Int) -> Int", desc: "Bitwise AND" },
        { sig: "math.bit_or(a: Int, b: Int) -> Int", desc: "Bitwise OR" },
        { sig: "math.bit_xor(a: Int, b: Int) -> Int", desc: "Bitwise XOR" },
        { sig: "math.bit_not(a: Int) -> Int", desc: "Bitwise NOT" },
        { sig: "math.shl(a: Int, n: Int) -> Int", desc: "Shift left" },
        { sig: "math.shr(a: Int, n: Int) -> Int", desc: "Shift right" },
        { sig: "math.seed_rng(seed: Int)", desc: "Seed random number generator" },
        { sig: "math.random() -> Float64", desc: "Random float 0..1" },
        { sig: "math.random_range(min: Int, max: Int) -> Int", desc: "Random int in range" },
        { sig: "math.random_float() -> Float64", desc: "Random float 0..1" },
        { sig: "math.clamp(x: Float64, lo: Float64, hi: Float64) -> Float64", desc: "Clamp to range" },
        { sig: "math.lerp(a: Float64, b: Float64, t: Float64) -> Float64", desc: "Linear interpolation" },
        { sig: "math.is_nan(x: Float64) -> Bool", desc: "Check if NaN" },
        { sig: "math.is_inf(x: Float64) -> Bool", desc: "Check if infinity" },
      ]
    },
    {
      name: "num",
      desc: "Numeric traits, integer utilities, checked/wrapping arithmetic",
      wasm: "★",
      functions: [
        { sig: "interface Neg", desc: "fn neg(self) -> Self" },
        { sig: "interface Rem", desc: "fn rem(self, other: Self) -> Self" },
        { sig: "interface Abs", desc: "fn abs(self) -> Self" },
        { sig: "interface Pow", desc: "fn pow(self, exp: Self) -> Self" },
        { sig: "interface Sqrt", desc: "fn sqrt(self) -> Self" },
        { sig: "interface Bounded", desc: "min_value, max_value, epsilon, zero" },
        { sig: "num.min_value[T:Bounded]() -> T", desc: "Minimum representable value" },
        { sig: "num.max_value[T:Bounded]() -> T", desc: "Maximum representable value" },
        { sig: "num.epsilon[T:Bounded]() -> T", desc: "Machine epsilon" },
        { sig: "num.gcd(a: Int, b: Int) -> Int", desc: "Greatest common divisor" },
        { sig: "num.lcm(a: Int, b: Int) -> Int", desc: "Least common multiple" },
        { sig: "num.is_power_of_two(n: Int) -> Bool", desc: "Check power of two" },
        { sig: "num.next_power_of_two(n: Int) -> Int", desc: "Next power of two" },
        { sig: "num.count_ones(n: Int) -> Int", desc: "Population count" },
        { sig: "num.count_zeros(n: Int) -> Int", desc: "Count zero bits" },
        { sig: "num.leading_zeros(n: Int) -> Int", desc: "Leading zero bits" },
        { sig: "num.trailing_zeros(n: Int) -> Int", desc: "Trailing zero bits" },
        { sig: "num.rotate_left(n: Int, k: Int) -> Int", desc: "Rotate bits left" },
        { sig: "num.rotate_right(n: Int, k: Int) -> Int", desc: "Rotate bits right" },
        { sig: "num.reverse_bits(n: Int) -> Int", desc: "Reverse bit order" },
        { sig: "num.to_be(n: Int) -> Int", desc: "To big-endian" },
        { sig: "num.to_le(n: Int) -> Int", desc: "To little-endian" },
        { sig: "num.from_be(n: Int) -> Int", desc: "From big-endian" },
        { sig: "num.from_le(n: Int) -> Int", desc: "From little-endian" },
        { sig: "num.is_finite(x: Float64) -> Bool", desc: "Check if finite" },
        { sig: "num.is_normal(x: Float64) -> Bool", desc: "Check if normal" },
        { sig: "num.classify(x: Float64) -> Int", desc: "Classify float" },
        { sig: "num.floor(x: Float64) -> Int", desc: "Floor to int" },
        { sig: "num.ceil(x: Float64) -> Int", desc: "Ceil to int" },
        { sig: "num.round(x: Float64) -> Int", desc: "Round to int" },
        { sig: "num.trunc(x: Float64) -> Int", desc: "Truncate to int" },
        { sig: "num.fract(x: Float64) -> Float64", desc: "Fractional part" },
        { sig: "num.recip(x: Float64) -> Float64", desc: "Reciprocal (1/x)" },
        { sig: "num.to_degrees(rad: Float64) -> Float64", desc: "Radians to degrees" },
        { sig: "num.to_radians(deg: Float64) -> Float64", desc: "Degrees to radians" },
        { sig: "num.hypot(x: Float64, y: Float64) -> Float64", desc: "Hypotenuse" },
        { sig: "num.saturating_add[T](a: T, b: T) -> T", desc: "Saturating addition" },
        { sig: "num.saturating_sub[T](a: T, b: T) -> T", desc: "Saturating subtraction" },
        { sig: "num.saturating_mul[T](a: T, b: T) -> T", desc: "Saturating multiplication" },
        { sig: "num.checked_add[T](a: T, b: T) -> Option[T]", desc: "Checked addition" },
        { sig: "num.checked_sub[T](a: T, b: T) -> Option[T]", desc: "Checked subtraction" },
        { sig: "num.checked_mul[T](a: T, b: T) -> Option[T]", desc: "Checked multiplication" },
        { sig: "num.checked_div[T](a: T, b: T) -> Option[T]", desc: "Checked division" },
        { sig: "num.wrapping_add[T](a: T, b: T) -> T", desc: "Wrapping addition" },
        { sig: "num.wrapping_sub[T](a: T, b: T) -> T", desc: "Wrapping subtraction" },
        { sig: "num.wrapping_mul[T](a: T, b: T) -> T", desc: "Wrapping multiplication" },
        { sig: "num.parse_int(s: Str) -> Result[Int, Str]", desc: "Parse integer from string" },
        { sig: "num.parse_float(s: Str) -> Result[Float64, Str]", desc: "Parse float from string" },
        { sig: "num.parse_int_radix(s: Str, radix: Int) -> Result[Int, Str]", desc: "Parse int with radix" },
      ]
    },
    {
      name: "cmp",
      desc: "Comparison, Ordering enum, min/max/clamp",
      wasm: "★",
      functions: [
        { sig: "Ordering", desc: "enum { Less, Equal, Greater }" },
        { sig: "Reverse[T]", desc: "Wraps value for reverse ordering" },
        { sig: "interface PartialEq[Rhs:Self]", desc: "eq, ne" },
        { sig: "interface PartialOrd[Rhs:Self]", desc: "partial_cmp, lt, le, gt, ge" },
        { sig: "Ordering.reverse(self) -> Ordering", desc: "Reverse the ordering" },
        { sig: "Ordering.then(self, other: Ordering) -> Ordering", desc: "Chain orderings" },
        { sig: "Ordering.then_with(self, f: fn() -> Ordering) -> Ordering", desc: "Chain with lazy fn" },
        { sig: "cmp.min[T:Ord](a: T, b: T) -> T", desc: "Generic minimum" },
        { sig: "cmp.max[T:Ord](a: T, b: T) -> T", desc: "Generic maximum" },
        { sig: "cmp.clamp[T:Ord](val: T, min: T, max: T) -> T", desc: "Generic clamp" },
        { sig: "cmp.min_by[T](a: T, b: T, cmp: fn(&T,&T)->Ordering) -> T", desc: "Min by comparator" },
        { sig: "cmp.max_by[T](a: T, b: T, cmp: fn(&T,&T)->Ordering) -> T", desc: "Max by comparator" },
        { sig: "cmp.max_int(a: Int, b: Int) -> Int", desc: "Max of two ints" },
        { sig: "cmp.min_int(a: Int, b: Int) -> Int", desc: "Min of two ints" },
        { sig: "cmp.clamp_int(val: Int, min: Int, max: Int) -> Int", desc: "Clamp int" },
        { sig: "cmp.max_float(a: Float64, b: Float64) -> Float64", desc: "Max of two floats" },
        { sig: "cmp.min_float(a: Float64, b: Float64) -> Float64", desc: "Min of two floats" },
        { sig: "cmp.clamp_float(val: Float64, min: Float64, max: Float64) -> Float64", desc: "Clamp float" },
        { sig: "Reverse.new[T](value: T) -> Reverse[T]", desc: "Create reverse wrapper" },
      ]
    },
    {
      name: "hash",
      desc: "Hashing interfaces, DefaultHasher, and hash utilities",
      wasm: "★",
      functions: [
        { sig: "interface Hash", desc: "fn hash(self, hasher: Hasher)" },
        { sig: "interface Hasher", desc: "write, write_int, write_str, finish" },
        { sig: "interface BuildHasher", desc: "fn build_hasher(self) -> Hasher" },
        { sig: "DefaultHasher.new() -> DefaultHasher", desc: "Create default hasher" },
        { sig: "DefaultHasher.write(self, bytes: &Vec[UInt8])", desc: "Write bytes to hasher" },
        { sig: "DefaultHasher.write_int(self, n: Int)", desc: "Write integer to hasher" },
        { sig: "DefaultHasher.write_str(self, s: Str)", desc: "Write string to hasher" },
        { sig: "DefaultHasher.finish(self) -> Int", desc: "Finalize and return hash" },
        { sig: "Int.hash(self, hasher: Hasher)", desc: "Hash an Int" },
        { sig: "Str.hash(self, hasher: Hasher)", desc: "Hash a Str" },
        { sig: "Bool.hash(self, hasher: Hasher)", desc: "Hash a Bool" },
        { sig: "hash.hash_value[T:Hash](value: &T) -> Int", desc: "Hash any Hash type" },
        { sig: "hash.hash_combine(seed: Int, hash: Int) -> Int", desc: "Combine two hashes" },
        { sig: "hash.hash[T:Hash](value: T) -> UInt64", desc: "Hash value to UInt64" },
        { sig: "hash.sip_hash(data: &Vec[UInt8]) -> UInt64", desc: "SipHash" },
      ]
    },
    {
      name: "char",
      desc: "Character classification and conversion (32-bit Unicode)",
      wasm: "★",
      functions: [
        { sig: "char.is_alphabetic(c: Char) -> Bool", desc: "Check if letter" },
        { sig: "char.is_alphanumeric(c: Char) -> Bool", desc: "Check if letter or digit" },
        { sig: "char.is_ascii(c: Char) -> Bool", desc: "Check if ASCII" },
        { sig: "char.is_control(c: Char) -> Bool", desc: "Check if control char" },
        { sig: "char.is_digit(c: Char) -> Bool", desc: "Check if decimal digit" },
        { sig: "char.is_lowercase(c: Char) -> Bool", desc: "Check if lowercase" },
        { sig: "char.is_uppercase(c: Char) -> Bool", desc: "Check if uppercase" },
        { sig: "char.is_numeric(c: Char) -> Bool", desc: "Check if numeric" },
        { sig: "char.is_punctuation(c: Char) -> Bool", desc: "Check if punctuation" },
        { sig: "char.is_whitespace(c: Char) -> Bool", desc: "Check if whitespace" },
        { sig: "char.to_lowercase(c: Char) -> Char", desc: "Convert to lowercase" },
        { sig: "char.to_uppercase(c: Char) -> Char", desc: "Convert to uppercase" },
        { sig: "char.to_digit(c: Char, radix: Int) -> Option[Int]", desc: "Char to digit value" },
        { sig: "char.from_digit(n: Int, radix: Int) -> Option[Char]", desc: "Digit value to char" },
        { sig: "char.len_utf8(c: Char) -> Int", desc: "UTF-8 byte length" },
        { sig: "char.encode_utf8(c: Char, buf: &mut Vec[UInt8])", desc: "Encode to UTF-8 bytes" },
      ]
    },
    {
      name: "convert",
      desc: "Type conversions - CRITICAL: XIOM has NO implicit conversions",
      wasm: "★",
      functions: [
        { sig: "interface From[T]", desc: "fn from(value: T) -> Self" },
        { sig: "interface Into[T]", desc: "fn into(self) -> T" },
        { sig: "interface TryFrom[T]", desc: "fn try_from(value: T) -> Result[Self, Str]" },
        { sig: "interface TryInto[T]", desc: "fn try_into(self) -> Result[T, Str]" },
        { sig: "convert.identity[T](x: T) -> T", desc: "Identity function" },
        { sig: "convert.int_to_float(n: Int) -> Float64", desc: "Int -> Float64" },
        { sig: "convert.float_to_int(f: Float64) -> Int", desc: "Float64 -> Int (truncates)" },
        { sig: "convert.int_to_string(n: Int) -> Str", desc: "Int -> Str" },
        { sig: "convert.float_to_string(f: Float64) -> Str", desc: "Float64 -> Str" },
        { sig: "convert.bool_to_string(b: Bool) -> Str", desc: "Bool -> Str" },
        { sig: "convert.char_to_int(c: Char) -> Int", desc: "Char -> Int" },
        { sig: "convert.int_to_char(n: Int) -> Option[Char]", desc: "Int -> Char" },
      ]
    },
    {
      name: "iter",
      desc: "Iterators, ranges, and adapter chains (map, filter, zip, fold, etc.)",
      wasm: "★",
      functions: [
        { sig: "Range", desc: "{ start: Int; end: Int }" },
        { sig: "RangeInclusive", desc: "{ start: Int; end: Int; current: Int; done: Bool }" },
        { sig: "MapIter[T,U]", desc: "Map adapter iterator" },
        { sig: "FilterIter[T]", desc: "Filter adapter iterator" },
        { sig: "EnumerateIter[T]", desc: "Enumerate adapter" },
        { sig: "TakeIter[T]", desc: "Take adapter" },
        { sig: "SkipIter[T]", desc: "Skip adapter" },
        { sig: "ChainIter[T,U]", desc: "Chain adapter" },
        { sig: "ZipIter[T,U]", desc: "Zip adapter" },
        { sig: "iter.range(start: Int, end: Int) -> Range", desc: "Create half-open range" },
        { sig: "iter.range_inclusive(start: Int, end: Int) -> RangeInclusive", desc: "Create inclusive range" },
        { sig: "Range.next(self) -> Option[Int]", desc: "Next value" },
        { sig: "Range.len(self) -> Int", desc: "Length of range" },
        { sig: "Range.contains(self, x: Int) -> Bool", desc: "Check containment" },
        { sig: "RangeInclusive.next(self) -> Option[Int]", desc: "Next value (inclusive)" },
        { sig: "Iterator[T].map[U](self, f: fn(T) -> U) -> MapIter[T,U]", desc: "Transform each element" },
        { sig: "Iterator[T].filter(self, p: fn(&T) -> Bool) -> FilterIter[T]", desc: "Keep matching elements" },
        { sig: "Iterator[T].enumerate(self) -> EnumerateIter[T]", desc: "Index each element" },
        { sig: "Iterator[T].take(self, n: Int) -> TakeIter[T]", desc: "Take first n elements" },
        { sig: "Iterator[T].skip(self, n: Int) -> SkipIter[T]", desc: "Skip first n elements" },
        { sig: "Iterator[T].chain[U](self, o: Iterator[U]) -> ChainIter[T,U]", desc: "Chain iterators" },
        { sig: "Iterator[T].zip[U](self, o: Iterator[U]) -> ZipIter[T,U]", desc: "Zip iterators" },
        { sig: "Iterator[T].collect(self) -> Vec[T]", desc: "Collect into Vec" },
        { sig: "Iterator[T].fold[B](self, init: B, f: fn(B,T) -> B) -> B", desc: "Reduce with accumulator" },
        { sig: "Iterator[T].count(self) -> Int", desc: "Count elements" },
        { sig: "Iterator[T].sum(self) -> T", desc: "Sum elements" },
        { sig: "Iterator[T].product(self) -> T", desc: "Product of elements" },
        { sig: "Iterator[T].max(self) -> Option[T]", desc: "Maximum element" },
        { sig: "Iterator[T].min(self) -> Option[T]", desc: "Minimum element" },
        { sig: "Iterator[T].find(self, p: fn(&T) -> Bool) -> Option[T]", desc: "Find first matching" },
        { sig: "Iterator[T].all(self, p: fn(&T) -> Bool) -> Bool", desc: "All match predicate?" },
        { sig: "Iterator[T].any(self, p: fn(&T) -> Bool) -> Bool", desc: "Any match predicate?" },
        { sig: "Iterator[T].nth(self, n: Int) -> Option[T]", desc: "Nth element" },
        { sig: "Iterator[T].last(self) -> Option[T]", desc: "Last element" },
      ]
    },
    {
      name: "array",
      desc: "Fixed-size array [N]T operations",
      wasm: "★",
      functions: [
        { sig: "array.len[T,const N](arr: &[N]T) -> Int", desc: "Array length (compile-time const)" },
        { sig: "array.is_empty[T,const N](arr: &[N]T) -> Bool", desc: "Check if empty" },
        { sig: "array.first[T](arr: &[N]T) -> Option[&T]", desc: "First element" },
        { sig: "array.last[T](arr: &[N]T) -> Option[&T]", desc: "Last element" },
        { sig: "array.get[T](arr: &[N]T, i: Int) -> Option[&T]", desc: "Safe indexed access" },
        { sig: "array.get_mut[T](arr: &mut [N]T, i: Int) -> Option[&mut T]", desc: "Mutable indexed access" },
        { sig: "array.map[T,U,const N](arr: [N]T, f: fn(T)->U) -> [N]U", desc: "Map over array" },
        { sig: "array.zip[T,U,const N](a: [N]T, b: [N]U) -> [N](T,U)", desc: "Zip two arrays" },
        { sig: "array.fold[T,B](arr: [N]T, init: B, f: fn(B,T)->B) -> B", desc: "Fold over array" },
        { sig: "array.as_slice[T](arr: &[N]T) -> Slice[T]", desc: "View as slice" },
        { sig: "array.as_mut_slice[T](arr: &mut [N]T) -> Slice[T]", desc: "Mutable slice view" },
        { sig: "array.each_ref[T](arr: &[N]T) -> [N]&T", desc: "Array of references" },
        { sig: "array.each_mut[T](arr: &mut [N]T) -> [N]&mut T", desc: "Array of mutable refs" },
        { sig: "array.fill[T:Clone](arr: &mut [N]T, value: T)", desc: "Fill with value" },
        { sig: "array.swap[T](arr: &mut [N]T, a: Int, b: Int)", desc: "Swap two elements" },
        { sig: "array.reverse[T](arr: &mut [N]T)", desc: "Reverse in place" },
        { sig: "array.rotate_left[T](arr: &mut [N]T, mid: Int)", desc: "Rotate left by mid" },
        { sig: "array.rotate_right[T](arr: &mut [N]T, k: Int)", desc: "Rotate right by k" },
        { sig: "array.sort[T:Ord](arr: &mut [N]T)", desc: "Sort in place" },
        { sig: "array.sort_by[T](arr: &mut [N]T, cmp: fn(&T,&T)->Ordering)", desc: "Sort by comparator" },
        { sig: "array.binary_search[T:Ord](arr: &[N]T, x: &T) -> Result[Int,Int]", desc: "Binary search" },
        { sig: "array.contains[T:Eq](arr: &[N]T, x: &T) -> Bool", desc: "Check containment" },
      ]
    },
    {
      name: "mem",
      desc: "Memory utilities: swap, replace, take, drop, ManuallyDrop",
      wasm: "★",
      functions: [
        { sig: "ManuallyDrop[T]", desc: "{ value: T } - suppresses Drop" },
        { sig: "mem.swap[T](a: &mut T, b: &mut T)", desc: "Swap two values" },
        { sig: "mem.replace[T](dest: &mut T, src: T) -> T", desc: "Replace and return old" },
        { sig: "mem.take[T:Default](dest: &mut T) -> T", desc: "Take value, leave default" },
        { sig: "mem.drop[T](value: T)", desc: "Explicitly drop value" },
        { sig: "mem.size_of[T]() -> Int", desc: "Size in bytes" },
        { sig: "mem.align_of[T]() -> Int", desc: "Alignment in bytes" },
        { sig: "mem.size_of_val[T](value: &T) -> Int", desc: "Size of value" },
        { sig: "mem.min_align_of_val[T](value: &T) -> Int", desc: "Min alignment of value" },
        { sig: "mem.zeroed[T]() -> T", desc: "Zero-initialized value" },
        { sig: "mem.uninitialized[T]() -> T", desc: "Uninitialized memory" },
        { sig: "ManuallyDrop.new[T](value: T) -> ManuallyDrop[T]", desc: "Create ManuallyDrop" },
        { sig: "ManuallyDrop.into_inner[T](self) -> T", desc: "Extract inner value (no drop)" },
        { sig: "ManuallyDrop.take[T](self) -> T", desc: "Take inner value" },
        { sig: "ManuallyDrop.drop[T](self)", desc: "Explicitly drop" },
      ]
    },

    {
      name: "alloc",
      desc: "Memory allocation: Layout, Allocator interface, global alloc/free",
      wasm: "★",
      functions: [
        { sig: "Layout", desc: "{ size: Int; align: Int }" },
        { sig: "AllocError", desc: "{ message: Str }" },
        { sig: "interface Allocator", desc: "allocate, deallocate, allocate_zeroed, grow, shrink" },
        { sig: "Layout.new(size: Int) -> Layout", desc: "Create layout" },
        { sig: "Layout.with_align(self, align: Int) -> Layout", desc: "Set alignment" },
        { sig: "Layout.padded_size(self) -> Int", desc: "Padded size" },
        { sig: "alloc.global_alloc() -> Allocator", desc: "Get global allocator" },
        { sig: "alloc.alloc(size: Int) -> *mut UInt8", desc: "Allocate raw memory" },
        { sig: "alloc.alloc_zeroed(size: Int) -> *mut UInt8", desc: "Allocate zeroed memory" },
        { sig: "alloc.realloc(ptr: *mut UInt8, old: Int, new: Int) -> *mut UInt8", desc: "Reallocate" },
        { sig: "alloc.dealloc(ptr: *mut UInt8, size: Int)", desc: "Free memory" },
        { sig: "alloc.alloc_layout(layout: Layout) -> *mut UInt8", desc: "Allocate with layout" },
        { sig: "alloc.dealloc_layout(ptr: *mut UInt8, layout: Layout)", desc: "Free with layout" },
      ]
    },
    {
      name: "error",
      desc: "Error trait hierarchy, error chaining, and backtraces",
      wasm: "★",
      functions: [
        { sig: "interface Error", desc: "source, description, cause" },
        { sig: "ErrorChain", desc: "{ errors: Vec[Str] }" },
        { sig: "Backtrace", desc: "{ frames: Vec[Str] }" },
        { sig: "Error.chain(self) -> ErrorChain", desc: "Build error chain" },
        { sig: "ErrorChain.display(self) -> Str", desc: "Display error chain" },
        { sig: "error.wrap_error[T,E:Error](r: Result[T,E], ctx: Str) -> Result[T,Str]", desc: "Wrap with context" },
        { sig: "error.context[T,E](r: Result[T,E], msg: Str) -> Result[T,Str]", desc: "Add context message" },
        { sig: "error.capture_backtrace() -> Backtrace", desc: "Capture backtrace" },
        { sig: "Backtrace.display(self) -> Str", desc: "Display backtrace" },
      ]
    },
    {
      name: "path",
      desc: "Path manipulation with Path and PathBuf",
      wasm: "★",
      functions: [
        { sig: "Path", desc: "{ inner: Str } - immutable path" },
        { sig: "PathBuf", desc: "{ inner: Str } - mutable path buffer" },
        { sig: "Path.new(s: Str) -> Path", desc: "Create path" },
        { sig: "Path.parent(self) -> Option[Path]", desc: "Parent directory" },
        { sig: "Path.file_name(self) -> Option[Str]", desc: "File name component" },
        { sig: "Path.extension(self) -> Option[Str]", desc: "File extension" },
        { sig: "Path.file_stem(self) -> Option[Str]", desc: "File name without extension" },
        { sig: "Path.is_absolute(self) -> Bool", desc: "Check if absolute" },
        { sig: "Path.is_relative(self) -> Bool", desc: "Check if relative" },
        { sig: "Path.has_root(self) -> Bool", desc: "Has root component" },
        { sig: "Path.components(self) -> Vec[Str]", desc: "Path components" },
        { sig: "Path.to_str(self) -> Str", desc: "To string" },
        { sig: "Path.join(self, child: Str) -> PathBuf", desc: "Join with child" },
        { sig: "Path.with_extension(self, ext: Str) -> PathBuf", desc: "Replace extension" },
        { sig: "Path.with_file_name(self, name: Str) -> PathBuf", desc: "Replace file name" },
        { sig: "Path.exists(self) -> Bool", desc: "Check if path exists" },
        { sig: "Path.is_file(self) -> Bool", desc: "Check if regular file" },
        { sig: "Path.is_dir(self) -> Bool", desc: "Check if directory" },
        { sig: "Path.metadata(self) -> Result[Metadata, Str]", desc: "Get metadata" },
        { sig: "Path.canonicalize(self) -> Result[PathBuf, Str]", desc: "Canonicalize path" },
        { sig: "Path.starts_with(self, base: &Path) -> Bool", desc: "Check prefix" },
        { sig: "Path.ends_with(self, child: &Path) -> Bool", desc: "Check suffix" },
        { sig: "PathBuf.new() -> PathBuf", desc: "Create empty path buffer" },
        { sig: "PathBuf.from(s: Str) -> PathBuf", desc: "Create from string" },
        { sig: "PathBuf.push(self, component: Str)", desc: "Append component" },
        { sig: "PathBuf.pop(self) -> Bool", desc: "Remove last component" },
        { sig: "PathBuf.as_path(self) -> Path", desc: "View as Path" },
        { sig: "PathBuf.clear(self)", desc: "Clear to empty" },
        { sig: "path.path_separator() -> Str", desc: "Platform path separator" },
      ]
    },
    {
      name: "time",
      desc: "Duration, Instant, SystemTime, DateTime - limited in WASM",
      wasm: "⚠",
      functions: [
        { sig: "Duration", desc: "{ secs: Int; nanos: Int }" },
        { sig: "Instant", desc: "{ t: Int }" },
        { sig: "SystemTime", desc: "{ secs: Int; nanos: Int }" },
        { sig: "DateTime", desc: "{ year: Int; month: Int; day: Int; hour: Int; minute: Int; second: Int; weekday: Int }" },
        { sig: "Duration.new(secs: Int, nanos: Int) -> Duration", desc: "Create duration", wasm: "★" },
        { sig: "Duration.from_secs(s: Int) -> Duration", desc: "From seconds", wasm: "★" },
        { sig: "Duration.from_secs_f64(s: Float64) -> Duration", desc: "From fractional seconds", wasm: "★" },
        { sig: "Duration.from_millis(ms: Int) -> Duration", desc: "From milliseconds", wasm: "★" },
        { sig: "Duration.from_micros(us: Int) -> Duration", desc: "From microseconds", wasm: "★" },
        { sig: "Duration.from_nanos(ns: Int) -> Duration", desc: "From nanoseconds", wasm: "★" },
        { sig: "Duration.as_secs(self) -> Int", desc: "To seconds", wasm: "★" },
        { sig: "Duration.as_millis(self) -> Int", desc: "To milliseconds", wasm: "★" },
        { sig: "Duration.as_micros(self) -> Int", desc: "To microseconds", wasm: "★" },
        { sig: "Duration.as_nanos(self) -> Int", desc: "To nanoseconds", wasm: "★" },
        { sig: "Duration.as_secs_f64(self) -> Float64", desc: "To fractional seconds", wasm: "★" },
        { sig: "Duration.subsec_nanos(self) -> Int", desc: "Sub-second nanos part", wasm: "★" },
        { sig: "Duration.add(self, other: Duration) -> Duration", desc: "Add durations", wasm: "★" },
        { sig: "Duration.sub(self, other: Duration) -> Duration", desc: "Subtract durations", wasm: "★" },
        { sig: "Duration.mul(self, factor: Int) -> Duration", desc: "Multiply by scalar", wasm: "★" },
        { sig: "Duration.div(self, divisor: Int) -> Duration", desc: "Divide by scalar", wasm: "★" },
        { sig: "Duration.checked_add(self, o: Duration) -> Option[Duration]", desc: "Checked add", wasm: "★" },
        { sig: "Duration.checked_sub(self, o: Duration) -> Option[Duration]", desc: "Checked subtract", wasm: "★" },
        { sig: "Instant.now() -> Instant", desc: "Current instant", wasm: "⚠" },
        { sig: "Instant.elapsed(self) -> Duration", desc: "Time since instant", wasm: "⚠" },
        { sig: "Instant.duration_since(self, earlier: Instant) -> Duration", desc: "Duration between instants", wasm: "★" },
        { sig: "Instant.add(self, d: Duration) -> Instant", desc: "Add duration", wasm: "★" },
        { sig: "Instant.sub(self, d: Duration) -> Instant", desc: "Subtract duration", wasm: "★" },
        { sig: "SystemTime.now() -> SystemTime", desc: "Current system time", wasm: "✗" },
        { sig: "SystemTime.unix_epoch() -> SystemTime", desc: "Unix epoch (1970-01-01)", wasm: "★" },
        { sig: "SystemTime.duration_since(self, earlier: SystemTime) -> Result[Duration,Str]", desc: "Duration since", wasm: "★" },
        { sig: "SystemTime.secs_since_epoch(self) -> Int", desc: "Seconds since epoch", wasm: "★" },
        { sig: "DateTime.now() -> DateTime", desc: "Current date/time", wasm: "⚠" },
        { sig: "DateTime.year(self) -> Int", desc: "Year component", wasm: "★" },
        { sig: "DateTime.month(self) -> Int", desc: "Month (1-12)", wasm: "★" },
        { sig: "DateTime.day(self) -> Int", desc: "Day of month", wasm: "★" },
        { sig: "DateTime.hour(self) -> Int", desc: "Hour (0-23)", wasm: "★" },
        { sig: "DateTime.minute(self) -> Int", desc: "Minute (0-59)", wasm: "★" },
        { sig: "DateTime.second(self) -> Int", desc: "Second (0-59)", wasm: "★" },
        { sig: "DateTime.weekday(self) -> Int", desc: "Day of week (0=Sun)", wasm: "★" },
        { sig: "time.utc_now() -> DateTime", desc: "Current UTC date/time", wasm: "⚠" },
        { sig: "time.local_now() -> DateTime", desc: "Current local date/time", wasm: "⚠" },
        { sig: "time.sleep(dur: Duration)", desc: "Sleep for duration", wasm: "✗" },
        { sig: "time.sleep_ms(ms: Int)", desc: "Sleep milliseconds", wasm: "✗" },
        { sig: "time.sleep_until(instant: Instant)", desc: "Sleep until instant", wasm: "✗" },
      ]
    },
    {
      name: "env",
      desc: "Environment variables, directories, and platform constants",
      wasm: "⚠",
      functions: [
        { sig: "env.OS: Str", desc: "OS name ('windows')", wasm: "★" },
        { sig: "env.ARCH: Str", desc: "Architecture ('x86_64')", wasm: "★" },
        { sig: "env.FAMILY: Str", desc: "OS family ('unix' or 'windows')", wasm: "★" },
        { sig: "env.var(name: Str) -> Result[Str, Str]", desc: "Get env variable", wasm: "⚠" },
        { sig: "env.var_opt(name: Str) -> Option[Str]", desc: "Get env variable (optional)", wasm: "⚠" },
        { sig: "env.set_var(name: Str, value: Str)", desc: "Set env variable", wasm: "✗" },
        { sig: "env.remove_var(name: Str)", desc: "Remove env variable", wasm: "✗" },
        { sig: "env.vars() -> Vec[(Str, Str)]", desc: "All env variables", wasm: "✗" },
        { sig: "env.args() -> Vec[Str]", desc: "Command-line arguments", wasm: "✗" },
        { sig: "env.args_os() -> Vec[Str]", desc: "Raw OS arguments", wasm: "✗" },
        { sig: "env.current_exe() -> Result[Str, Str]", desc: "Current executable path", wasm: "✗" },
        { sig: "env.current_dir() -> Result[Str, Str]", desc: "Current working directory", wasm: "⚠" },
        { sig: "env.set_current_dir(path: Str) -> Result[Unit, Str]", desc: "Change working directory", wasm: "✗" },
        { sig: "env.temp_dir() -> Str", desc: "Temporary directory", wasm: "★" },
        { sig: "env.home_dir() -> Option[Str]", desc: "Home directory", wasm: "⚠" },
        { sig: "env.data_dir() -> Option[Str]", desc: "Data directory", wasm: "⚠" },
        { sig: "env.cache_dir() -> Option[Str]", desc: "Cache directory", wasm: "⚠" },
        { sig: "env.config_dir() -> Option[Str]", desc: "Config directory", wasm: "⚠" },
        { sig: "env.executable_dir() -> Option[Str]", desc: "Executable directory", wasm: "⚠" },
        { sig: "env.join_paths(a: Str, b: Str) -> Str", desc: "Join path components", wasm: "★" },
        { sig: "env.path_separator() -> Str", desc: "Platform path separator", wasm: "★" },
      ]
    },
    {
      name: "os",
      desc: "Platform info, process management, filesystem walk, pipes, signals",
      wasm: "✗",
      functions: [
        { sig: "ChildProcess", desc: "{ pid: Int; stdin: Int; stdout: Int; stderr: Int }" },
        { sig: "FileWatcher", desc: "{ path: Str; recursive: Bool }" },
        { sig: "FileEvent", desc: "enum { Created(path), Modified(path), Deleted(path), Renamed(from,to) }" },
        { sig: "Pipe", desc: "{ read_fd: Int; write_fd: Int }" },
        { sig: "os.platform() -> Str", desc: "Platform name" },
        { sig: "os.cpu_count() -> Int", desc: "Number of CPU cores" },
        { sig: "os.total_memory() -> Int", desc: "Total system memory (bytes)" },
        { sig: "os.free_memory() -> Int", desc: "Free system memory (bytes)" },
        { sig: "os.env_set(name: Str, value: Str)", desc: "Set env variable" },
        { sig: "os.env_unset(name: Str)", desc: "Unset env variable" },
        { sig: "os.current_dir() -> Str", desc: "Current working directory" },
        { sig: "os.set_current_dir(path: Str) -> Result[Unit, Str]", desc: "Change directory" },
        { sig: "os.temp_dir() -> Str", desc: "Temp directory" },
        { sig: "os.home_dir() -> Option[Str]", desc: "Home directory" },
        { sig: "os.walk_dir(path: Str, cb: fn(Str, Metadata)) -> Result[Unit, Str]", desc: "Recursive walk" },
        { sig: "os.walk_dir_filtered(path: Str, pat: Str, cb: fn(Str, Metadata)) -> Result[Unit, Str]", desc: "Filtered walk" },
        { sig: "os.watch_file(path: Str) -> Result[FileWatcher, Str]", desc: "Watch file for changes" },
        { sig: "os.watch_dir(path: Str, recursive: Bool) -> Result[FileWatcher, Str]", desc: "Watch directory" },
        { sig: "FileWatcher.poll(self) -> Result[Vec[FileEvent], Str]", desc: "Poll for events" },
        { sig: "FileWatcher.close(self)", desc: "Close watcher" },
        { sig: "ChildProcess.wait(self) -> Result[Int, Str]", desc: "Wait for process exit" },
        { sig: "ChildProcess.kill(self) -> Result[Unit, Str]", desc: "Kill process" },
        { sig: "ChildProcess.id(self) -> Int", desc: "Get process ID" },
        { sig: "os.on_signal(signal: Int, handler: fn(Int))", desc: "Register signal handler" },
        { sig: "os.raise_signal(signal: Int)", desc: "Raise signal" },
        { sig: "os.create_pipe() -> Result[Pipe, Str]", desc: "Create pipe" },
        { sig: "Pipe.read(self, buf: &mut Vec[UInt8]) -> Result[Int, Str]", desc: "Read from pipe" },
        { sig: "Pipe.write(self, data: &Vec[UInt8]) -> Result[Int, Str]", desc: "Write to pipe" },
        { sig: "Pipe.close_read(self)", desc: "Close read end" },
        { sig: "Pipe.close_write(self)", desc: "Close write end" },
        { sig: "os.disk_free(path: Str) -> Result[Int, Str]", desc: "Free disk space" },
        { sig: "os.disk_total(path: Str) -> Result[Int, Str]", desc: "Total disk space" },
        { sig: "os.file_size_bytes(path: Str) -> Result[Int, Str]", desc: "File size in bytes" },
        { sig: "SIGINT: Int = 2", desc: "Interrupt signal" },
        { sig: "SIGTERM: Int = 15", desc: "Terminate signal" },
        { sig: "SIGKILL: Int = 9", desc: "Kill signal" },
        { sig: "SIGUSR1: Int = 10", desc: "User-defined signal 1" },
        { sig: "SIGUSR2: Int = 12", desc: "User-defined signal 2" },
      ]
    },

  ]
};

// ── Rendering ──
function showStdlibRef() {
  var container = document.querySelector('.syntax-content');
  var headerTitle = document.querySelector('.syntax-header h3');
  if (!container || !headerTitle) return;
  headerTitle.textContent = 'Standard Library';

  var html = '<input type="text" class="concept-search" placeholder="Search all 20 modules..." oninput="filterStdlib(this.value)">';
  html += '<div class="stdlib-wasm-legend"><span class="wasm-badge wasm-full">★ WASM</span> <span class="wasm-badge wasm-partial">⚠ Limited</span> <span class="wasm-badge wasm-none">✗ None</span></div>';

  stdlibData.modules.forEach(function(mod) {
    html += '<div class="stdlib-module" data-stdlib-module="' + mod.name + '">';
    html += '<div class="stdlib-module-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
    html += '<span class="stdlib-module-arrow">▼</span>';
    html += '<span class="stdlib-module-name">' + mod.name + '</span>';
    html += '<span class="wasm-badge wasm-' + (mod.wasm === '★' ? 'full' : mod.wasm === '⚠' ? 'partial' : 'none') + '">' + mod.wasm + '</span>';
    html += '<span class="stdlib-module-desc">' + mod.desc + '</span>';
    html += '</div>';
    html += '<div class="stdlib-module-fns">';
    mod.functions.forEach(function(fn) {
      var w = fn.wasm || mod.wasm;
      html += '<div class="stdlib-fn" data-stdlib-search="' + mod.name + ' ' + fn.sig.toLowerCase() + ' ' + fn.desc.toLowerCase() + '">';
      html += '<code>' + esc(fn.sig) + '</code>';
      html += '<span class="wasm-badge wasm-' + (w === '★' ? 'full' : w === '⚠' ? 'partial' : 'none') + '" title="WASM: ' + (w === '★' ? 'Full' : w === '⚠' ? 'Limited' : 'Unavailable') + '">' + w + '</span>';
      html += '<span class="stdlib-fn-desc">' + fn.desc + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}

function filterStdlib(query) {
  var q = query.toLowerCase().trim();
  document.querySelectorAll('.stdlib-fn').forEach(function(el) {
    el.style.display = (q === '' || (el.getAttribute('data-stdlib-search') || '').indexOf(q) >= 0) ? '' : 'none';
  });
  document.querySelectorAll('.stdlib-module').forEach(function(mod) {
    var any = mod.querySelectorAll('.stdlib-fn:not([style*="display: none"])').length > 0;
    mod.style.display = any ? '' : 'none';
  });
}

function hideStdlibRef() {
  if (window.populateSyntaxPanel) window.populateSyntaxPanel();
  var t = document.querySelector('.syntax-header h3');
  if (t) t.textContent = 'Concepts';
}

// ── Persistent Panel Rendering ──
function showStdlibPanel() {
  var container = document.getElementById('stdlibPanelContent');

  var html = '';

  html += '<div class="stdlib-hero">';
  html += '<input type="text" class="stdlib-search" placeholder="Search all 594 functions..." oninput="filterStdlibPanel(this.value)">';
  html += '<div class="stdlib-quick-chips">';
  var quickChips = [
    { label: 'io.println', module: 'io', fnSig: 'io.println' },
    { label: 'Int.to_str', module: 'convert', fnSig: 'Int.to_str' },
    { label: 'Vec.push', module: 'collections', fnSig: 'Vec.push' },
    { label: 'if / elif / else', module: 'core', fnSig: 'if' },
    { label: 'fn', module: 'core', fnSig: 'fn' },
    { label: 'match', module: 'core', fnSig: 'match' },
  ];
  quickChips.forEach(function(chip) {
    html += '<span class="stdlib-chip" onclick="filterStdlibPanel(\'' + chip.label + '\'); var s = document.querySelector(\'.stdlib-search\'); if(s) s.value=\'' + chip.label + '\';" title="Jump to ' + chip.label + '">' + chip.label + '</span>';
  });
  html += '</div></div>';

  html += '<div class="stdlib-modules">';
  stdlibData.modules.forEach(function(mod, idx) {
    var totalFns = mod.functions.length;
    html += '<div class="stdlib-mod-card" data-stdlib-module="' + mod.name + '">';
    html += '<div class="stdlib-mod-card-header" onclick="this.parentElement.classList.toggle(\'open\')">';
    html += '<div class="stdlib-mod-card-left">';
    html += '<span class="stdlib-mod-card-arrow">▸</span>';
    html += '<span class="stdlib-mod-card-name">' + mod.name + '</span>';
    html += '<span class="stdlib-mod-card-badge">' + totalFns + '</span>';
    html += '</div>';
    html += '<span class="stdlib-mod-card-desc">' + mod.desc + '</span>';
    html += '</div>';
    html += '<div class="stdlib-mod-card-body">';
    mod.functions.forEach(function(fn) {
      html += '<div class="stdlib-fn-row" data-stdlib-search="' + mod.name + ' ' + fn.sig.toLowerCase() + ' ' + fn.desc.toLowerCase() + '" id="stdlib-fn-' + mod.name + '-' + fn.sig.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30) + '">';
      html += '<code>' + esc(fn.sig) + '</code>';
      html += '<span>' + fn.desc + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';

  html += '<div class="stdlib-footer">64 modules &middot; ~2,215 functions &middot; XIOM v0.58.0</div>';

  if (container) container.innerHTML = html;
}

function filterStdlibPanel(query) {
  var q = query.toLowerCase().trim();
  var panel = document.getElementById('stdlibPanel');
  if (!panel) return;

  panel.querySelectorAll('.stdlib-fn-row').forEach(function(row) {
    var text = (row.getAttribute('data-stdlib-search') || '').toLowerCase();
    row.style.display = (q === '' || text.indexOf(q) >= 0) ? '' : 'none';
  });
  panel.querySelectorAll('.stdlib-mod-card').forEach(function(mod) {
    var any = Array.from(mod.querySelectorAll('.stdlib-fn-row')).some(function(r) { return r.style.display !== 'none'; });
    mod.style.display = any ? '' : 'none';
  });
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
