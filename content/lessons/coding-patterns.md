---
title: Coding interview patterns — two pointers, sliding window, hash maps, recursion and dynamic programming
nav: Coding interview patterns
slug: coding-patterns
summary: How to solve coding interview problems: a step-by-step approach, recognising the common patterns (hash map, two pointers, sliding window, prefix sums, binary search on the answer, monotonic stack, BFS and DFS, backtracking, greedy, intervals, dynamic programming), complexity analysis and edge cases, with Java solutions and interview questions.
tags: [Algorithms, Coding interview, Two pointers, Sliding window, Dynamic programming, Backtracking, Greedy, Java]
order: 6
topic: Fundamentals / Data structures and algorithms
updated: 2026-11-14
subnav: true
---

Coding rounds rarely test whether you have memorised a problem. They test whether you can recognise a **pattern**, explain your reasoning, and write clean, correct code. A small set of patterns covers most questions: *find two numbers, longest substring with a property, the best window, count the ways, shortest path, all combinations.* This lesson gives a method for any problem, then each pattern with its clue, an example and Java code. It builds on [data structures and Big-O](lesson:data-structures) and [sorting and searching](lesson:sorting-searching), and uses the Java [collections](lesson:java-collections) and [streams](lesson:java-streams). Play the four scenes: two pointers, a sliding window, prefix sums and dynamic programming.

```demo
name: coding-pattern-walk
```

> **One sentence to remember:** *clarify the problem, do a brute force first and state its cost, then ask which pattern removes the repeated work (a hash map, two pointers, a window, a stack, a queue, memoisation), code it cleanly, and test it on small and edge cases out loud.*

## A method for any problem {#approach}

1. **Clarify.** Repeat the problem in your own words. Ask about input size and range, duplicates, negative numbers, sorted or not, empty input, and what to return when there is no answer.
2. **Examples.** Work one small example by hand, plus an edge case. It often reveals the pattern.
3. **Brute force.** Say the obvious solution and its complexity (usually nested loops, O(n²), or trying everything, O(2ⁿ)). It shows you understand the problem and gives a baseline.
4. **Find the waste.** What work is repeated? Looking things up again (use a hash map), re-adding a range (prefix sums or a window), comparing every pair (sort and use two pointers), solving the same subproblem repeatedly (memoisation).
5. **Code** the improved solution, with clear names and small steps.
6. **Test** by tracing your example, then empty, one element, duplicates, the largest case.
7. **State the complexity** (time and extra space) and a possible trade-off.

Talk throughout. Silence is the commonest way to lose points; a wrong first idea that you notice and fix aloud is fine.

## Which pattern? {#which}

| Clue in the problem | Pattern |
| --- | --- |
| find a pair or a value that you can look up; count, group, de-duplicate | hash map or set |
| sorted array, pair with a sum, palindrome, remove duplicates in place | two pointers |
| longest or shortest contiguous subarray or substring with a property; best window of size k | sliding window |
| many range-sum questions on a fixed array | prefix sums |
| sorted data, or "smallest x such that ..." | binary search (also on the answer) |
| next greater or smaller element, matching brackets, nested structure | stack, monotonic stack |
| shortest path, levels, minimum steps in a grid or graph | BFS |
| explore all paths, connected components, cycles, tree problems | DFS or recursion |
| generate all subsets, permutations or combinations | backtracking |
| count ways, minimum or maximum cost, choices that overlap | dynamic programming |
| locally best choice works (interval scheduling, coins of a canonical system) | greedy |
| top k, k-th largest, merge k sorted lists | heap |
| intervals overlapping or merging | sort by start, then sweep |

## Hash map and set {#hashmap}

Trade memory for time: remember what you have seen so each lookup is O(1) instead of a scan. Classic: **two sum**. For each number, check whether its complement (target minus the number) was already seen. That turns O(n²) into O(n). Also: frequency counts (anagrams, majority element), first non-repeating character, detect duplicates, group by key (`Map<String, List<String>>`), and counting subarrays with a given sum by storing prefix sums in a map.

## Two pointers {#two-pointers}

Two indices move through the data, usually from both ends towards the middle (sorted data) or one behind the other (fast and slow). Because of the order, each step lets you **discard** part of the search, so one pass is enough: O(n) time and O(1) space. Uses: pair with a given sum in a sorted array, three-sum (fix one, two pointers for the rest), reverse or palindrome check, merge two sorted arrays, remove duplicates in place, container with most water, and fast and slow pointers on linked lists (find the middle, detect a cycle).

## Sliding window {#window}

A **window** is a contiguous range `[left, right]`. Slide it by moving `right` forward, and update the answer incrementally (add the new element, remove the old one) instead of recomputing, so the total work is O(n).

- **Fixed size:** the best sum of k consecutive elements, the maximum in each window of size k (with a deque).
- **Variable size:** expand `right`, and **shrink `left` while the window is invalid**. Longest substring without repeating characters, smallest subarray with sum at least s, longest substring with at most k distinct characters.

Each element enters and leaves the window at most once, so even with the inner `while` loop the total is O(n).

## Prefix sums {#prefix}

Precompute `prefix[i] = a[0] + ... + a[i-1]` once in O(n). The sum of any range `[i, j]` is then `prefix[j+1] - prefix[i]` in O(1). Combine with a hash map of prefix sums seen so far to count subarrays that sum to k in O(n). The same idea in two dimensions answers rectangle sums; a **difference array** does the reverse (add a value to a whole range in O(1)).

## Binary search on the answer {#binary}

When a yes/no test flips from "no" to "yes" at one point, binary search the answer instead of the array: the smallest capacity that ships all packages in D days, the slowest eating speed that finishes the piles in time, the integer square root. Define `feasible(x)`, search the range of x, and move towards the boundary. Cost: O(log range times the cost of `feasible`). See [binary search](lesson:sorting-searching).

## Stack and monotonic stack {#stack}

A **stack** matches nested structure (brackets, expression evaluation, undoing). A **monotonic stack** keeps its elements in increasing or decreasing order and answers "next greater element" or "days until a warmer temperature" in O(n): while the new element is greater than the top, pop the top and record the answer for it; then push the new element. Each element is pushed and popped once.

## BFS, DFS and backtracking {#graph}

- **BFS** (a queue) for the fewest steps: shortest path in a grid or graph, level-order traversal, word ladder, multi-source spreading (rotting oranges). Mark visited when you enqueue.
- **DFS** (recursion or a stack) to explore: number of islands, connected components, cycle detection, tree depth, path sums. Keep a visited set for graphs; trees do not need one.
- **Backtracking** is DFS over choices: choose, recurse, **undo** the choice. It generates **subsets, permutations, combinations**, solves N-Queens and Sudoku, and finds word-search paths. Prune early (skip choices that cannot lead to a solution) because the search space is exponential.

## Dynamic programming {#dp}

Dynamic programming (DP) solves problems that have **overlapping subproblems** (the same smaller problem appears again and again) and **optimal substructure** (the best answer is built from best answers of smaller problems). Naive recursion repeats work and is often exponential; DP stores each result once.

Steps:

1. **Define the state:** what does `dp[i]` (or `dp[i][j]`) mean, in words?
2. **Write the recurrence:** how does a state depend on smaller states? (`dp[a] = 1 + min(dp[a - coin])`)
3. **Base cases:** `dp[0]`.
4. **Order of computation** and the answer: which cell holds the result?
5. **Optimise space** if the recurrence looks back only a few cells.

Two styles: **top-down** (recursion plus a memo map, easy to write from the recurrence) and **bottom-up** (fill a table from the base cases, no recursion depth problem, easier to optimise). Classic problems: Fibonacci and climbing stairs (1D), house robber, **coin change** (minimum coins, or the number of ways), 0/1 knapsack, longest common subsequence and edit distance (2D tables), longest increasing subsequence.

## Greedy and intervals {#greedy}

A **greedy** algorithm makes the locally best choice at each step and never reconsiders. It is correct only when a local choice provably leads to a global optimum, which you should be able to argue. Examples: choose the interval that ends earliest to schedule the most meetings, jump game, gas station. **Intervals:** sort by start, then sweep, merging while the next start is at or before the current end. If a greedy attempt has a counterexample, the problem is probably DP.

## Complexity and testing habits {#complexity}

- State time and space, counting recursion depth as space. A loop with a hash map per step is O(n); sorting first adds O(n log n).
- Recursion: branching factor to the power of depth (backtracking), or number of states times the work per state (DP).
- **Edge cases:** empty input, a single element, all equal elements, duplicates, negative numbers, the maximum size, integer overflow (`long` or `Math.addExact`), a target that does not exist.
- Prefer clear names and small helper methods; interviewers read your code. Do not optimise before the correct solution works.

## Cheat sheet {#cheatsheet}

| Pattern | Time | Space | Typical problem |
| --- | --- | --- | --- |
| Hash map | O(n) | O(n) | two sum, anagrams, subarray sum |
| Two pointers | O(n) | O(1) | pair sum in sorted array, palindrome |
| Sliding window | O(n) | O(1) or O(k) | longest substring without repeats |
| Prefix sums | O(n) prepare, O(1) query | O(n) | range sum, subarray sum equals k |
| Binary search | O(log n) | O(1) | search, first bad version, ship in D days |
| Monotonic stack | O(n) | O(n) | next greater element |
| BFS | O(V + E) | O(V) | shortest path in a grid |
| DFS | O(V + E) | O(depth) | islands, cycles |
| Backtracking | exponential | O(depth) | subsets, permutations |
| Dynamic programming | states times work per state | states | coin change, knapsack, LCS |
| Greedy + sort | O(n log n) | O(1) | merge intervals, meeting rooms |
| Heap | O(n log k) | O(k) | top k, merge k lists |

## Interview questions {#questions}

### [basic] How do you approach a coding problem in an interview? {#approach-q}

Clarify the requirements and constraints, work a small example, state a brute-force solution with its complexity, look for repeated work and the pattern that removes it, then code it, test on examples and edge cases, and state time and space complexity. Think aloud throughout, so the interviewer can follow and help.

### [basic] What is the brute-force approach and why mention it first? {#brute-force-q}

The simplest solution that is obviously correct, typically nested loops or trying every possibility. Saying it first shows you understand the problem, gives a correct baseline to compare against and test with, and often points to the waste (repeated work) that a better pattern removes.

### [basic] How does a hash map turn the two-sum problem from O(n²) into O(n)? {#two-sum-q}

Instead of checking every pair, you scan once and for each number look up its complement (target minus the number) in a map of numbers already seen. Each lookup is O(1) on average, so the whole scan is O(n), at the cost of O(n) extra memory.

### [basic] When do you use two pointers? {#two-pointers-q}

When the data is sorted, or you work from both ends or with two positions that move in one direction. Because of the order, each step lets you discard part of the search, so one pass is enough: O(n) time and O(1) space. Examples: pair sum in a sorted array, reversing, palindrome check, merging sorted arrays, removing duplicates in place.

### [basic] What is a sliding window? {#window-q}

A contiguous range over an array or string whose boundaries move forward, with the answer updated incrementally as elements enter and leave instead of being recomputed. A fixed window has a set size; a variable window grows on the right and shrinks on the left while a condition is violated. Each element enters and leaves at most once, so it runs in O(n).

### [intermediate] What are prefix sums useful for? {#prefix-q}

They answer many range-sum queries in O(1) after O(n) preparation: `prefix[j+1] - prefix[i]` is the sum of elements i to j. With a hash map of prefix sums you can count subarrays with sum k in one pass. The same idea works in two dimensions for rectangle sums.

### [intermediate] What is dynamic programming, and how do you recognise a DP problem? {#dp-q}

A technique that solves a problem by storing the answers to smaller overlapping subproblems so each is computed once. Signs: asking for the count of ways, the minimum or maximum cost, or whether something is possible; choices at each step; and a recursive solution that repeats the same calls. Define the state, write the recurrence, set the base cases, and decide the order of computation.

### [intermediate] What is the difference between memoisation and tabulation? {#memo-q}

Memoisation is top-down: write the recursive solution and cache each result in a map or array, so a repeated call returns instantly. Tabulation is bottom-up: fill a table from the base cases towards the answer with loops. Memoisation is quick to write and computes only needed states; tabulation avoids deep recursion and often allows reducing the memory to a few variables.

### [intermediate] What is backtracking and how is it different from DFS? {#backtracking-q}

Backtracking is DFS over a space of choices: make a choice, recurse, then undo it and try the next. It builds subsets, permutations, combinations and solutions to puzzles such as N-Queens. The difference from plain graph DFS is the explicit "undo", the pruning of choices that cannot work, and that the search space is generated, not given. The cost is exponential, so pruning matters.

### [intermediate] When does a greedy algorithm work? {#greedy-q}

When making the locally best choice at each step provably leads to a global optimum (the greedy-choice property together with optimal substructure). Interval scheduling by earliest end time is a standard example. When you cannot argue it, test for counterexamples; with an arbitrary coin system, for example, greedy coin change fails and dynamic programming is needed.

### [intermediate] How do you detect a cycle in a linked list? {#cycle-q}

Use fast and slow pointers (Floyd's algorithm): the slow pointer moves one step, the fast pointer two. If there is a cycle they meet inside it; if the fast pointer reaches null there is none. It takes O(n) time and O(1) space, unlike storing visited nodes in a set, which uses O(n) space.

### [intermediate] What is a monotonic stack and what problems does it solve? {#monotonic-q}

A stack kept in increasing or decreasing order. When a new element arrives, pop elements that violate the order and use that moment to answer for them, then push the new one. It solves next greater element, daily temperatures, largest rectangle in a histogram and similar problems in O(n), because each element is pushed and popped once.

### [intermediate] What is binary search on the answer? {#binary-answer-q}

Instead of searching an array, you search a range of possible answers, using a function `feasible(x)` that is false below some threshold and true at and above it. Binary search finds the boundary in O(log range) calls. Examples: the minimum ship capacity to deliver within D days, the minimum eating speed, the integer square root.

### [deep] How do you generate all permutations or subsets, and what does it cost? {#generate-q}

With backtracking: for subsets, at each element choose to include or exclude it, giving 2ⁿ subsets; for permutations, try each unused element in each position, giving n! results. Because the output itself is that large, the time is at least O(2ⁿ) or O(n!) times the cost of copying each result. Skip duplicates by sorting and skipping equal neighbours at the same level.

### [deep] How would you reduce the space of a dynamic programming solution? {#dp-space-q}

If each state depends only on a few previous states, keep only those. Coin change and Fibonacci-style recurrences use one array or a few variables; a 2D table where each row depends only on the previous row can be reduced to two rows or one row updated in the right direction. The trade-off is that reconstructing the actual solution, not just its value, is harder without the full table.

### [deep] How do you handle large inputs and overflow in these problems? {#overflow-q}

State the size limits first and pick an approach that fits: O(n²) is fine for 5,000 elements but not for a million. Watch for integer overflow when adding or multiplying (use `long`, `Math.addExact`, or `BigInteger`/`BigDecimal` for money), take care with `(lo + hi) / 2`, avoid deep recursion on large inputs (use iteration or an explicit stack), and consider streaming approaches when the data does not fit in memory.

### [coding] Two sum: return the indices of two numbers that add up to a target. {#coding-two-sum}

```java
static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();          // value -> index
    for (int i = 0; i < nums.length; i++) {
        Integer j = seen.get(target - nums[i]);             // is the complement already seen?
        if (j != null) return new int[] { j, i };
        seen.put(nums[i], i);
    }
    return new int[0];                                      // no pair found
}
```

Explain that the brute force checks all pairs in O(n²), that the map remembers earlier values so each number needs one O(1) lookup, that checking before inserting stops an element being paired with itself, and that the total is O(n) time and O(n) space. For a sorted array, two pointers use O(1) space.

### [coding] Longest substring without repeating characters (variable sliding window). {#coding-longest-substring}

```java
static int longestUnique(String s) {
    Map<Character, Integer> lastSeen = new HashMap<>();
    int best = 0, left = 0;
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        Integer previous = lastSeen.get(c);
        if (previous != null && previous >= left) {
            left = previous + 1;                            // shrink the window past the earlier copy
        }
        lastSeen.put(c, right);
        best = Math.max(best, right - left + 1);            // window length
    }
    return best;
}
```

Explain that the window `[left, right]` always holds distinct characters, that when a character repeats inside the window `left` jumps just past its previous position, that each index is visited once so the time is O(n), and that the map holds at most the size of the alphabet.

### [coding] Merge overlapping intervals. {#coding-intervals}

```java
static int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));   // sort by start
    List<int[]> merged = new ArrayList<>();
    for (int[] current : intervals) {
        if (merged.isEmpty() || merged.get(merged.size() - 1)[1] < current[0]) {
            merged.add(current);                                    // no overlap with the last interval
        } else {
            int[] last = merged.get(merged.size() - 1);
            last[1] = Math.max(last[1], current[1]);                // overlap: extend the end
        }
    }
    return merged.toArray(new int[0][]);
}
```

Explain that sorting by start means overlapping intervals are neighbours, that one sweep either extends the last merged interval or starts a new one, and that the time is O(n log n) for the sort and O(n) for the sweep. Note that equal ends and touching intervals (end equals next start) are merged here because `<` is used.

### [coding] Coin change: the fewest coins to make an amount (dynamic programming). {#coding-coin-change}

```java
static int minCoins(int[] coins, int amount) {
    int[] dp = new int[amount + 1];                         // dp[a] = fewest coins for amount a
    Arrays.fill(dp, amount + 1);                            // "infinity": more than any possible answer
    dp[0] = 0;                                              // base case: no coins make 0
    for (int a = 1; a <= amount; a++) {
        for (int coin : coins) {
            if (coin <= a) {
                dp[a] = Math.min(dp[a], dp[a - coin] + 1);  // use this coin plus the best for the rest
            }
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];           // -1 when the amount cannot be made
}
```

Explain that the state is the fewest coins for each amount, that each state reuses a smaller one, that the base case is `dp[0] = 0`, that the time is O(amount times number of coins) and the space O(amount), and that a greedy approach (always take the largest coin) fails for some coin sets, such as coins 1, 3, 4 for amount 6.

### [coding] Generate all subsets of an array (backtracking). {#coding-subsets}

```java
static List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrack(nums, 0, new ArrayList<>(), result);
    return result;
}

private static void backtrack(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
    result.add(new ArrayList<>(current));                   // every path is a subset: copy it
    for (int i = start; i < nums.length; i++) {
        current.add(nums[i]);                               // choose
        backtrack(nums, i + 1, current, result);            // explore with the remaining elements
        current.remove(current.size() - 1);                 // undo the choice
    }
}
```

Explain the choose, explore, undo pattern, that the result is copied because `current` keeps changing, that there are 2ⁿ subsets so the time is O(n times 2ⁿ), and that skipping equal neighbours after sorting handles duplicates.
