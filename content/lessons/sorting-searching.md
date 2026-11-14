---
title: Sorting and searching — binary search, merge sort, quicksort and what Java uses
nav: Sorting and searching
slug: sorting-searching
summary: Searching and sorting for interviews: linear and binary search, binary search pitfalls and variants, the main sorting algorithms and their complexity, stability and in-place sorting, divide and conquer, quickselect and top-k with heaps, and how Java sorts (Arrays.sort, TimSort, Comparator), with Java code and interview questions.
tags: [Algorithms, Sorting, Searching, Binary search, Merge sort, Quicksort, Complexity, Java]
order: 5
topic: Fundamentals / Data structures and algorithms
updated: 2026-11-14
subnav: true
---

Sorting and searching are the first algorithms every interviewer reaches for: *write a binary search, why is merge sort O(n log n), which sort is stable, what does Java's `Arrays.sort` use, how do you find the k-th largest number without sorting everything?* This lesson explains the ideas, shows them step by step, and gives the Java code. It builds on [data structures and Big-O](lesson:data-structures) and leads into [coding patterns](lesson:coding-patterns). Java specifics link to the [collections](lesson:java-collections), [HashMap](lesson:java-hashmap) and [streams](lesson:java-streams) lessons. Play the five scenes: binary search, a search that fails, insertion sort, merge sort and quicksort.

```demo
name: sort-search-walk
```

> **One sentence to remember:** *binary search needs sorted data and halves the range each step (O(log n)); good general sorts are O(n log n) by splitting the problem (merge sort, quicksort); and in Java you almost always call the library sort and spend your effort on a correct Comparator.*

## Searching {#searching}

**Linear search** checks items one by one: O(n), works on any data, no preparation. **Binary search** works on a **sorted** array: compare with the middle element and throw away half the range each step, so it takes O(log n) comparisons (about 20 for a million items, 30 for a billion). The price is that the data must be sorted and must allow jumping to the middle (arrays yes, linked lists no).

```java
static int binarySearch(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {                       // an empty range ends the loop
        int mid = lo + (hi - lo) / 2;        // not (lo + hi) / 2: that can overflow for large arrays
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;   // the target is to the right
        else hi = mid - 1;                   // the target is to the left
    }
    return -1;                               // not found
}
```

Common mistakes, and the usual follow-up questions:

- **Off-by-one errors:** `lo <= hi` with `mid + 1` and `mid - 1`, or `lo < hi` with `hi = mid`. Pick one style and stay consistent.
- **Integer overflow** in `(lo + hi) / 2`; write `lo + (hi - lo) / 2` (or `>>> 1`).
- **Duplicates:** to find the *first* or *last* occurrence, keep searching after a match (`hi = mid - 1` to go left).
- **Library behaviour:** `Arrays.binarySearch` and `Collections.binarySearch` return the index if found, otherwise `-(insertion point) - 1`, so a negative result tells you where the value would be inserted. The array must be sorted first, or the result is undefined.

**Binary search is more general than searching an array.** Whenever a yes/no question changes from "no" to "yes" at one point (monotonic), you can binary search the answer: the smallest capacity that ships all packages in D days, the first bad version of a release, the square root of a number to a precision. Variants include searching a **rotated sorted array** (find which half is sorted, then decide where the target can be) and finding a **peak**.

## Sorting overview {#sorting}

| Algorithm | Best | Average | Worst | Extra space | Stable | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | yes | teaching only |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | no | few swaps |
| **Insertion sort** | O(n) | O(n²) | O(n²) | O(1) | yes | fast for small or nearly sorted data |
| **Merge sort** | O(n log n) | O(n log n) | O(n log n) | O(n) | yes | predictable, good for linked lists and external data |
| **Quicksort** | O(n log n) | O(n log n) | O(n²) | O(log n) | no | fastest in practice, in place |
| Heap sort | O(n log n) | O(n log n) | O(n log n) | O(1) | no | worst case guaranteed, in place |
| Counting, radix | O(n + k) | O(n + k) | O(n + k) | O(k) | yes | not comparison sorts, for small integer ranges |

Two facts to know: any sort that **compares** elements needs at least about n log n comparisons in the worst case, and sorts that do not compare (counting, radix, bucket) can beat it when the keys are small integers or fit a known range.

**Stable** means equal elements keep their original relative order. It matters when you sort by several keys in turn: sort transactions by amount, then stably by date, and the amounts stay in order within each date.

**In place** means the sort uses only O(1) or O(log n) extra memory, not a copy of the data.

## Divide and conquer {#divide}

Merge sort and quicksort are **divide and conquer**: split the problem, solve the parts, combine the results.

- **Merge sort:** split in half, sort each half recursively, **merge** the two sorted halves in O(n). With log n levels of splitting and O(n) work per level, the total is O(n log n), whatever the input. It needs O(n) extra space for merging.
- **Quicksort:** choose a **pivot**, **partition** the array so smaller elements are left of it and larger ones right (the pivot is then in its final place), and sort both sides recursively. Balanced splits give O(n log n); a pivot that is always the smallest or largest (for example the first element of already sorted data) gives O(n²). Remedies: a random pivot or median-of-three. It sorts in place and is very cache friendly, which is why it is fastest in practice.

A recurrence like T(n) = 2T(n/2) + n describes merge sort and solves to O(n log n) (the master theorem). Recursion uses the call stack, so quicksort's stack depth matters: recurse into the smaller part first to keep it at O(log n).

## Sorting in Java {#java}

- **`Arrays.sort(int[])`** and other primitive arrays use a **dual-pivot quicksort** (not stable, but stability does not matter for primitives).
- **`Arrays.sort(Object[])`, `List.sort`, `Collections.sort`** use **TimSort**, a hybrid of merge sort and insertion sort that exploits existing runs in the data: **stable**, O(n log n) worst case, close to O(n) on nearly sorted data.
- **`Arrays.parallelSort`** splits the work across cores for large arrays (see [concurrency](lesson:java-concurrency)).
- **`Comparator`** defines the order: `Comparator.comparing(Transaction::date).thenComparing(Transaction::amount, Comparator.reverseOrder())`. A comparator must be **consistent** (antisymmetric, transitive); a broken one makes TimSort throw `IllegalArgumentException: Comparison method violates its general contract`. Never subtract integers in a comparator (`a - b` can overflow); use `Integer.compare`.
- **Streams:** `stream().sorted(comparator)` is stable for ordered streams.
- **Sorted structures:** `TreeMap` and `TreeSet` keep elements sorted on insert (O(log n) each) and `PriorityQueue` gives the smallest element first; see [collections](lesson:java-collections).

```java
record Transaction(String id, LocalDate date, BigDecimal amount) {}

List<Transaction> list = new ArrayList<>(transactions);
list.sort(Comparator.comparing(Transaction::date)                            // oldest first
                    .thenComparing(Transaction::amount, Comparator.reverseOrder())   // then largest first
                    .thenComparing(Transaction::id));                        // last tie-break: make it deterministic
```

## Top-k and the k-th element {#topk}

Sorting everything to find the largest few is wasteful (O(n log n)). Better:

- **Min-heap of size k:** scan the data, keep the k largest seen so far in a `PriorityQueue`, and drop the smallest when the size exceeds k. Time O(n log k), memory O(k), and it works on a stream of unknown length.
- **Quickselect:** partition like quicksort but recurse into only the side that contains the k-th position: O(n) on average, O(n²) worst, in place, and it modifies the array.
- **Counting or bucketing** when values fall in a small range.

## Practical notes {#practical}

- Do not write your own sort in production: use the library, and spend the effort on a correct comparator and on avoiding sorting when you do not need to (a heap, a `TreeMap` or a hash index may be better).
- **Sort once, search many times:** the cost of sorting pays off when you binary search repeatedly. For a single lookup, linear search or a hash set is cheaper.
- **External sorting:** data larger than memory is sorted in chunks, each chunk sorted and written out, then merged (a multi-way merge sort). Databases do this for `ORDER BY` without an index.
- **Indexes:** a database index is a sorted structure (a B-tree) that turns a scan into a binary-search-like lookup; see [SQL vs NoSQL](lesson:sql-vs-nosql).

## Cheat sheet {#cheatsheet}

| Need | Use |
| --- | --- |
| find a value in sorted data | binary search, O(log n) |
| find the first or last occurrence | binary search that keeps going after a match |
| smallest value that satisfies a monotonic test | binary search on the answer |
| general-purpose sort | library sort (TimSort for objects, dual-pivot quicksort for primitives) |
| keep equal items in order | a stable sort (merge sort, TimSort) |
| nearly sorted data, small arrays | insertion sort |
| sort in place with little memory | quicksort or heap sort |
| top k of a big stream | min-heap of size k |
| the k-th element without a full sort | quickselect |
| integers in a small range | counting sort or radix sort |

## Interview questions {#questions}

### [basic] What is binary search and what does it require? {#binary-search-q}

An algorithm that finds a value in a sorted array by comparing with the middle element and discarding half the range each step. It runs in O(log n) time and O(1) space (iterative). It requires the data to be sorted and to allow random access, such as an array or `ArrayList`. On a linked list the jump to the middle costs O(n), which removes the benefit.

### [basic] What is the time complexity of binary search and why? {#binary-complexity-q}

O(log n). Each comparison halves the remaining range, so for n items you need about log₂ n steps before the range is empty: roughly 20 for a million and 30 for a billion.

### [basic] What is the difference between a stable and an unstable sort? {#stable-q}

A stable sort keeps equal elements in their original relative order; an unstable one may reorder them. It matters when sorting records by several keys one after another. Merge sort, insertion sort and TimSort are stable; quicksort, heap sort and selection sort usually are not.

### [basic] What sorting algorithm does Java use? {#java-sort-q}

For primitive arrays, `Arrays.sort` uses a dual-pivot quicksort. For objects, `Arrays.sort`, `Collections.sort` and `List.sort` use TimSort, a stable hybrid of merge sort and insertion sort that is O(n log n) worst case and close to O(n) on nearly sorted data. `Arrays.parallelSort` uses several cores for large arrays.

### [basic] Compare merge sort and quicksort. {#merge-vs-quick-q}

Merge sort is O(n log n) in every case and stable, but needs O(n) extra memory. Quicksort is O(n log n) on average and usually faster in practice because it sorts in place and is cache friendly, but its worst case is O(n²) with bad pivots and it is not stable. Use merge sort when you need stability or guaranteed time (or have linked lists); quicksort variants when speed and memory matter.

### [intermediate] How does quicksort work and when is it slow? {#quicksort-q}

Pick a pivot, partition the array so smaller elements are on the left and larger on the right (the pivot lands in its final place), then sort both sides recursively. It is fast when the pivot splits the array roughly in half. It degrades to O(n²) when pivots are consistently extreme, for example always taking the first element of already sorted data. Random or median-of-three pivots avoid this.

### [intermediate] Why is merge sort O(n log n)? {#merge-complexity-q}

The array is halved repeatedly, giving about log₂ n levels. At each level every element takes part in one merge step, so the work per level is O(n). Together that is n times log n, in the best, average and worst case, because the splitting does not depend on the data.

### [intermediate] What is the lower bound for comparison sorting and how can you beat it? {#lower-bound-q}

Any sort that works only by comparing elements needs Ω(n log n) comparisons in the worst case (a decision tree with n! leaves has height log n!). Non-comparison sorts, such as counting sort, radix sort and bucket sort, use the structure of the keys (small integers, fixed length) to run in O(n + k).

### [intermediate] How do you find the k largest elements of a large stream? {#topk-q}

Keep a min-heap (a `PriorityQueue`) of size k. For each element, add it; if the size exceeds k, remove the smallest. At the end the heap holds the k largest. It takes O(n log k) time and O(k) memory and does not need all data in memory, unlike sorting the whole input (O(n log n)).

### [intermediate] What is quickselect? {#quickselect-q}

A selection algorithm based on the quicksort partition: partition around a pivot, then recurse only into the side that contains the k-th position, because the pivot's final index is known. It finds the k-th smallest element in O(n) on average (O(n²) worst case) and in place, without sorting everything.

### [intermediate] What are common mistakes when writing binary search? {#binary-mistakes-q}

Off-by-one errors in the loop condition and the bounds (`lo <= hi` with `mid ± 1`), integer overflow in `(lo + hi) / 2` (use `lo + (hi - lo) / 2`), an infinite loop when `mid` does not make progress, running it on unsorted data, and mishandling duplicates when asked for the first or last occurrence.

### [intermediate] What does `Arrays.binarySearch` return when the key is missing? {#binary-library-q}

`-(insertion point) - 1`, where the insertion point is the index at which the key would be inserted to keep the array sorted. So any negative result means not found, and `-result - 1` gives the position to insert. The result is undefined if the array is not sorted.

### [intermediate] How would you sort a list of transactions by date, then by amount descending? {#comparator-q}

Use a chained comparator: `Comparator.comparing(Transaction::date).thenComparing(Transaction::amount, Comparator.reverseOrder())`, optionally with a final tie-break such as the id so the order is deterministic. Avoid hand-written subtraction comparators because they overflow; use `Integer.compare`, `Long.compare` or `BigDecimal.compareTo`.

### [deep] What happens when a comparator violates its contract? {#comparator-contract-q}

TimSort may throw `IllegalArgumentException: Comparison method violates its general contract`, or produce a wrongly ordered result without error. The comparator must be consistent: if a < b and b < c then a < c, `compare(a, b)` is the negative of `compare(b, a)`, and it must not change while sorting. Common causes are comparing with subtraction that overflows, using inconsistent rules, or mutating elements during the sort.

### [deep] How would you sort a file much larger than memory? {#external-sort-q}

External merge sort: read chunks that fit in memory, sort each chunk and write it to disk as a sorted run, then do a multi-way merge of the runs using a min-heap holding the head of each run, writing the output sequentially. Minimise passes by using large chunks and a wide merge. Databases use the same technique for `ORDER BY` and index builds.

### [deep] How do you search a rotated sorted array in O(log n)? {#rotated-q}

At each step at least one half of the range is sorted. Compare `a[lo]` with `a[mid]` to find which half is sorted, check whether the target lies inside that sorted half, and move `lo` or `hi` accordingly. That still halves the range every step, so it is O(log n). Duplicates can force a linear scan in the worst case.

### [deep] When is a hash table better than sorting and binary search? {#hash-vs-sort-q}

For repeated exact-match lookups, a hash set or map gives O(1) average time without sorting. Sorting plus binary search is better when you also need ordered operations: range queries, nearest value, min and max, or output in sorted order, and when memory is tight. A balanced tree (`TreeMap`) supports both ordered operations and inserts in O(log n).

### [coding] Write binary search for the first occurrence of a value. {#coding-first-occurrence}

```java
static int firstOccurrence(int[] a, int target) {
    int lo = 0, hi = a.length - 1, answer = -1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == target) {
            answer = mid;          // remember it, but keep looking to the left
            hi = mid - 1;
        } else if (a[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return answer;
}
```

Explain that a normal search stops at any match, that here a match is recorded and the search continues in the left half, that it is still O(log n), and that the last occurrence is found the same way by continuing to the right.

### [coding] Implement merge sort. {#coding-merge-sort}

```java
static int[] mergeSort(int[] a) {
    if (a.length <= 1) return a;                           // base case: already sorted
    int mid = a.length / 2;
    int[] left = mergeSort(Arrays.copyOfRange(a, 0, mid));
    int[] right = mergeSort(Arrays.copyOfRange(a, mid, a.length));
    return merge(left, right);
}

static int[] merge(int[] left, int[] right) {
    int[] result = new int[left.length + right.length];
    int i = 0, j = 0, k = 0;
    while (i < left.length && j < right.length) {
        result[k++] = left[i] <= right[j] ? left[i++] : right[j++];   // <= keeps it stable
    }
    while (i < left.length) result[k++] = left[i++];
    while (j < right.length) result[k++] = right[j++];
    return result;
}
```

Explain that the array is split until single elements remain, that `merge` combines two sorted arrays in one pass (O(n)), that taking the left element on ties keeps the sort stable, and that the total time is O(n log n) with O(n) extra space.

### [coding] Find the k-th largest element with a heap. {#coding-kth-largest}

```java
static int kthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();    // min-heap: the smallest is on top
    for (int n : nums) {
        heap.offer(n);
        if (heap.size() > k) heap.poll();                   // drop the smallest, keep the k largest
    }
    return heap.peek();                                      // the smallest of the k largest = the k-th largest
}
```

Explain that the heap never holds more than k elements, so each step is O(log k) and the total is O(n log k), that the answer is the top of the heap, and that quickselect gives O(n) average time if modifying the input is allowed.

### [coding] Quicksort with a random pivot (Lomuto partition). {#coding-quicksort}

```java
static void quickSort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(a, lo, hi);
    quickSort(a, lo, p - 1);
    quickSort(a, p + 1, hi);
}

static int partition(int[] a, int lo, int hi) {
    int r = ThreadLocalRandom.current().nextInt(lo, hi + 1);   // random pivot avoids the O(n²) case on sorted data
    swap(a, r, hi);
    int pivot = a[hi];
    int s = lo;                                                // next slot for an element smaller than the pivot
    for (int j = lo; j < hi; j++) {
        if (a[j] < pivot) swap(a, s++, j);
    }
    swap(a, s, hi);                                            // the pivot lands in its final place
    return s;
}

static void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
```

Explain that `s` marks the end of the smaller part, that after the loop the pivot is swapped into position `s` and never moves again, that both sides are sorted recursively, that the average time is O(n log n) and the worst case O(n²) (unlikely with a random pivot), and that it sorts in place.
