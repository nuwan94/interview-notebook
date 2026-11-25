---
title: Coding interview patterns — two pointers, sliding window, hash maps, recursion and dynamic programming
nav: Coding interview patterns
slug: coding-patterns
summary: How to solve coding interview problems: a step-by-step approach, recognising the common patterns (hash map, two pointers, sliding window, prefix sums, binary search on the answer, monotonic stack, BFS and DFS, backtracking, greedy, intervals, dynamic programming), complexity analysis and edge cases, with Java solutions and interview questions.
tags: [Algorithms, Coding interview, Two pointers, Sliding window, Dynamic programming, Backtracking, Greedy, Java]
order: 6
topic: Fundamentals / Data structures and algorithms
updated: 2026-11-24
subnav: true
---

A coding round rarely tests whether you memorised a problem. It tests three things:

- Can you recognise the **pattern** behind the problem?
- Can you explain your reasoning?
- Can you write clean, correct code?

A small set of patterns covers most questions. Typical tasks: find two numbers, find the longest substring with some property, find the best window, count the ways, find the shortest path, list all combinations.

This lesson first gives a method that works for any problem. Then it explains each pattern with its clue, an example and Java code.

Related lessons: it builds on [data structures and Big-O](lesson:data-structures) and [sorting and searching](lesson:sorting-searching), and uses the Java [collections](lesson:java-collections) and [streams](lesson:java-streams).

The animation has four scenes: two pointers, a sliding window, prefix sums and dynamic programming.

```demo
name: coding-pattern-walk
```

> **One sentence to remember:** *Start with the brute force, then pick the pattern that removes its repeated work.*

## A method for any problem {#approach}

1. **Clarify.** Repeat the problem in your own words. Ask about the input size and range, duplicates, negative numbers, whether the data is sorted, empty input, and what to return when there is no answer.
2. **Work an example.** Solve one small example by hand, plus one edge case. This often reveals the pattern.
3. **Say the brute force.** Describe the obvious solution and its cost. It is usually nested loops, O(n²), or trying everything, O(2ⁿ). This shows you understand the problem and gives you a baseline.
4. **Find the waste.** Ask what work is repeated, and remove it:
   - Looking the same things up again: use a hash map.
   - Adding up the same range again: use prefix sums or a window.
   - Comparing every pair: sort, then use two pointers.
   - Solving the same smaller problem again: store the answer (memoisation).
5. **Code** the better solution, with clear names and small steps.
6. **Test** it. Trace your example, then try empty input, one element, duplicates and the largest case.
7. **State the complexity**, both time and extra space, and mention any trade-off.

Talk the whole time. Silence is the most common way to lose points. A wrong first idea that you notice and fix out loud is fine.

## Which pattern? {#which}

| Clue in the problem | Pattern |
| --- | --- |
| Find a pair or a value you can look up. Count, group or remove duplicates. | Hash map or set |
| A sorted array, a pair with a given sum, a palindrome, or removing duplicates in place. | Two pointers |
| The longest or shortest contiguous subarray or substring with some property. The best window of size k. | Sliding window |
| Many range-sum questions on an array that does not change. | Prefix sums |
| Sorted data, or "the smallest x such that ...". | Binary search, also on the answer |
| The next greater or smaller element, matching brackets, or a nested structure. | Stack or monotonic stack |
| The shortest path, levels, or the fewest steps in a grid or graph. | BFS |
| Exploring all paths, connected components, cycles, or tree problems. | DFS or recursion |
| Generating all subsets, permutations or combinations. | Backtracking |
| Counting ways, a minimum or maximum cost, or choices whose results overlap. | Dynamic programming |
| The locally best choice is provably right, as in interval scheduling or coins of a standard currency. | Greedy |
| The top k, the k-th largest, or merging k sorted lists. | Heap |
| Intervals that overlap or must be merged. | Sort by start, then sweep |

## Hash map and set {#hashmap}

A hash map trades memory for time. You remember what you have already seen, so each lookup costs O(1) instead of a full scan.

The classic example is **two sum**: find two numbers that add up to a target. For each number, check whether its **complement** (the target minus the number) was already seen. That turns O(n²) into O(n).

Other uses:

- Frequency counts, as in anagrams or finding the majority element.
- The first character that does not repeat.
- Detecting duplicates.
- Grouping by a key, with `Map<String, List<String>>`.
- Counting subarrays with a given sum, by storing the prefix sums seen so far in a map.

## Two pointers {#two-pointers}

Two indexes move through the data. Usually they start at both ends and move towards the middle (on sorted data). Or one runs ahead of the other (a fast and a slow pointer).

Because the data is ordered, each step lets you **discard** part of the search. So one pass is enough: O(n) time and O(1) space.

Uses:

- A pair with a given sum in a sorted array.
- Three-sum: fix one number, then use two pointers for the rest.
- Reversing an array, or checking a palindrome.
- Merging two sorted arrays.
- Removing duplicates in place.
- Container with most water.
- Fast and slow pointers on a linked list, to find the middle or detect a cycle.

## Sliding window {#window}

A **window** is a contiguous range `[left, right]` of an array or string. You slide it by moving `right` forward. You update the answer step by step: add the element that enters and remove the one that leaves. You never recompute the whole window, so the total work is O(n).

- **Fixed size:** the best sum of k consecutive elements, or the maximum in each window of size k (using a deque).
- **Variable size:** move `right` forward, and **move `left` forward while the window breaks the rule**. Examples: the longest substring without repeating characters, the smallest subarray with a sum of at least s, and the longest substring with at most k distinct characters.

Each element enters the window once and leaves it at most once. So even with the inner `while` loop, the total is O(n).

## Prefix sums {#prefix}

Compute `prefix[i] = a[0] + ... + a[i-1]` once, in O(n). Then the sum of any range `[i, j]` is `prefix[j+1] - prefix[i]`, in O(1).

- Combine it with a hash map of the prefix sums seen so far to count the subarrays that sum to k, in O(n).
- The same idea in two dimensions answers rectangle sums.
- A **difference array** does the reverse: it adds a value to a whole range in O(1).

## Binary search on the answer {#binary}

Sometimes a yes-or-no test flips from "no" to "yes" at one point. Then you can binary search the answer itself instead of an array.

Examples:

- The smallest ship capacity that delivers all packages in D days.
- The slowest eating speed that still finishes all the piles in time.
- The integer square root.

How: write a function `feasible(x)`, search the range of possible x values, and move towards the point where the answer flips. The cost is O(log of the range) times the cost of one `feasible` call. See [binary search](lesson:sorting-searching).

## Stack and monotonic stack {#stack}

A **stack** handles nested structure: matching brackets, evaluating expressions and undo.

A **monotonic stack** keeps its elements in increasing or decreasing order. It answers questions like "the next greater element" or "how many days until a warmer temperature" in O(n):

1. While the new element is greater than the top of the stack, pop the top. The new element is the answer for the popped one.
2. Push the new element.

Each element is pushed once and popped at most once.

## BFS, DFS and backtracking {#graph}

- **BFS** (with a queue) finds the fewest steps. Uses: the shortest path in a grid or graph, level-order traversal, word ladder, and spreading from many sources at once (rotting oranges). Mark a node as visited when you add it to the queue.
- **DFS** (with recursion or a stack) explores. Uses: counting islands, connected components, cycle detection, tree depth and path sums. Graphs need a visited set. Trees do not, because they have no cycles.
- **Backtracking** is DFS over choices: make a choice, recurse, then **undo** the choice. It generates **subsets, permutations and combinations**, solves N-Queens and Sudoku, and finds paths in a word search. The number of options grows exponentially, so **prune** early: skip any choice that cannot lead to a solution.

## Dynamic programming {#dp}

Dynamic programming (DP) solves problems with two properties:

- **Overlapping subproblems.** The same smaller problem comes up again and again.
- **Optimal substructure.** The best answer is built from the best answers to smaller problems.

Plain recursion repeats the same work and is often exponential. DP computes each smaller answer once and stores it.

Steps:

1. **Define the state.** Say in words what `dp[i]` (or `dp[i][j]`) means.
2. **Write the recurrence.** How does a state depend on smaller states? For example, `dp[a] = 1 + min(dp[a - coin])`.
3. **Set the base cases**, such as `dp[0]`.
4. **Choose the order of computation**, and say which cell holds the answer.
5. **Save space** if each state looks back only a few cells.

There are two styles:

- **Top-down:** recursion plus a memo (a map or array of stored answers). It is easy to write straight from the recurrence.
- **Bottom-up:** fill a table with loops, starting from the base cases. There is no recursion depth problem, and it is easier to save space.

Classic problems:

- One-dimensional: Fibonacci, climbing stairs, house robber, **coin change** (the fewest coins, or the number of ways), and the longest increasing subsequence.
- Two-dimensional tables: 0/1 knapsack, the longest common subsequence and edit distance.

## Greedy and intervals {#greedy}

A **greedy** algorithm makes the best choice it can see at each step and never goes back. It is correct only when a local choice provably leads to the best overall answer, and you should be able to argue why.

Examples: to schedule the most meetings, always pick the meeting that ends earliest. Also the jump game and the gas station problem.

**Intervals:** sort them by start, then sweep through them. Merge while the next start is at or before the current end.

If you find a counterexample to a greedy attempt, the problem probably needs DP.

## Complexity and testing habits {#complexity}

- **State both time and space.** Count recursion depth as space. A loop with one hash map step per element is O(n). Sorting first adds O(n log n).
- **Recursion cost.** For backtracking, it is the branching factor to the power of the depth. For DP, it is the number of states times the work per state.
- **Edge cases to test:** empty input, a single element, all elements equal, duplicates, negative numbers, the maximum size, integer overflow (use `long` or `Math.addExact`), and a target that does not exist.
- **Write readable code.** Use clear names and small helper methods, because the interviewer reads your code. Make it correct before you make it fast.

Try it in the lab: [Sliding window: one pass instead of two loops](lab:sliding-window).

## Cheat sheet {#cheatsheet}

| Pattern | Time | Space | Typical problem |
| --- | --- | --- | --- |
| Hash map | O(n) | O(n) | Two sum, anagrams, subarray sum |
| Two pointers | O(n) | O(1) | Pair sum in a sorted array, palindrome |
| Sliding window | O(n) | O(1) or O(k) | Longest substring without repeats |
| Prefix sums | O(n) to prepare, O(1) per query | O(n) | Range sum, subarray sum equals k |
| Binary search | O(log n) | O(1) | Search, first bad version, ship in D days |
| Monotonic stack | O(n) | O(n) | Next greater element |
| BFS | O(V + E) | O(V) | Shortest path in a grid |
| DFS | O(V + E) | O(depth) | Islands, cycles |
| Backtracking | Exponential | O(depth) | Subsets, permutations |
| Dynamic programming | States times work per state | States | Coin change, knapsack, LCS |
| Greedy plus sort | O(n log n) | O(1) | Merge intervals, meeting rooms |
| Heap | O(n log k) | O(k) | Top k, merge k lists |

## Interview questions {#questions}

### [basic] How do you approach a coding problem in an interview? {#approach-q}

**With the same seven steps every time.**

1. Clarify the requirements and limits.
2. Work a small example.
3. State a brute-force solution and its cost.
4. Look for repeated work, and the pattern that removes it.
5. Write the code.
6. Test it on your example and on edge cases.
7. State the time and space complexity.

Think out loud the whole time, so the interviewer can follow you and help.

### [basic] What is the brute-force approach and why mention it first? {#brute-force-q}

It is the simplest solution that is obviously correct. Usually it is nested loops or trying every possibility.

Saying it first helps in three ways:

1. It shows you understand the problem.
2. It gives a correct baseline to compare and test against.
3. It often points to the repeated work that a better pattern removes.

### [basic] How does a hash map turn the two-sum problem from O(n²) into O(n)? {#two-sum-q}

**It replaces the inner loop with a lookup.**

- The brute force checks every pair, which is O(n²).
- Instead, scan once. For each number, look up its complement (the target minus the number) in a map of the numbers already seen.
- Each lookup is O(1) on average, so the whole scan is O(n).

The cost is O(n) extra memory for the map.

### [basic] When do you use two pointers? {#two-pointers-q}

**When the data is sorted, or when you work from both ends, or with two positions that only move forward.**

Because of the order, each step discards part of the search, so one pass is enough: O(n) time and O(1) space.

Examples: a pair sum in a sorted array, reversing, a palindrome check, merging sorted arrays and removing duplicates in place.

### [basic] What is a sliding window? {#window-q}

It is a contiguous range over an array or string whose ends move forward. The answer is updated as elements enter and leave, instead of being recomputed.

- A **fixed** window always has the same size.
- A **variable** window grows on the right, and shrinks on the left while a rule is broken.

Each element enters and leaves at most once, so it runs in O(n).

### [intermediate] What are prefix sums useful for? {#prefix-q}

**They answer many range-sum questions in O(1) each, after O(n) preparation.**

- `prefix[j+1] - prefix[i]` is the sum of the elements from i to j.
- With a hash map of prefix sums, you can count the subarrays that sum to k in one pass.
- The same idea works in two dimensions, for rectangle sums.

### [intermediate] What is dynamic programming, and how do you recognise a DP problem? {#dp-q}

It is a technique that stores the answers to smaller, overlapping subproblems, so each one is computed only once.

Signs of a DP problem:

- It asks for the number of ways, a minimum or maximum cost, or whether something is possible.
- You make a choice at each step.
- A recursive solution calls itself with the same arguments again and again.

To solve it: define the state, write the recurrence, set the base cases and decide the order of computation.

### [intermediate] What is the difference between memoisation and tabulation? {#memo-q}

**Memoisation works top-down. Tabulation works bottom-up.**

- **Memoisation:** write the recursive solution and store each result in a map or array. A repeated call then returns at once. It is quick to write and computes only the states you need.
- **Tabulation:** fill a table with loops, from the base cases up to the answer. It avoids deep recursion, and often lets you cut the memory down to a few variables.

### [intermediate] What is backtracking and how is it different from DFS? {#backtracking-q}

Backtracking is DFS over a space of choices. You make a choice, recurse, then undo the choice and try the next one. It builds subsets, permutations and combinations, and solves puzzles such as N-Queens.

How it differs from plain graph DFS:

1. It has an explicit "undo" step.
2. It prunes choices that cannot work.
3. The search space is generated as you go, not given as a graph.

The cost is exponential, so pruning matters.

### [intermediate] When does a greedy algorithm work? {#greedy-q}

**When the locally best choice at each step provably leads to the best overall answer.** This is called the greedy-choice property, and it must come together with optimal substructure.

- Interval scheduling by earliest end time is the standard example.
- When you cannot argue it, look for a counterexample. With an arbitrary set of coins, for example, greedy coin change fails, and you need dynamic programming.

### [intermediate] How do you detect a cycle in a linked list? {#cycle-q}

**With a fast and a slow pointer (Floyd's algorithm).**

1. The slow pointer moves one step at a time. The fast pointer moves two.
2. If there is a cycle, the fast pointer catches up and they meet inside it.
3. If the fast pointer reaches `null`, there is no cycle.

It takes O(n) time and O(1) space. Storing visited nodes in a set also works, but uses O(n) space.

### [intermediate] What is a monotonic stack and what problems does it solve? {#monotonic-q}

It is a stack whose elements stay in increasing or decreasing order.

1. When a new element arrives, pop every element that would break the order.
2. Each pop is the moment to record that element's answer.
3. Then push the new element.

It solves next greater element, daily temperatures, the largest rectangle in a histogram and similar problems in O(n), because each element is pushed once and popped once.

### [intermediate] What is binary search on the answer? {#binary-answer-q}

**You binary search a range of possible answers instead of an array.**

- You write a function `feasible(x)`. It is false below some threshold and true at and above it.
- Binary search finds that threshold in O(log of the range) calls.

Examples: the smallest ship capacity that delivers within D days, the slowest eating speed that finishes in time, and the integer square root.

### [deep] How do you generate all permutations or subsets, and what does it cost? {#generate-q}

**With backtracking.**

- **Subsets:** at each element, choose to include it or leave it out. That gives 2ⁿ subsets.
- **Permutations:** in each position, try every element not used yet. That gives n! results.

The output itself is that large, so the time is at least O(2ⁿ) or O(n!), times the cost of copying each result. To skip duplicates, sort first and skip equal neighbours at the same level.

### [deep] How would you reduce the space of a dynamic programming solution? {#dp-space-q}

**Keep only the states you still need.**

- If each state depends on only a few earlier states, keep only those. Coin change and Fibonacci-style problems need one array or a few variables.
- In a 2D table where each row depends only on the row before it, keep two rows, or one row updated in the right direction.

The trade-off: without the full table, it is harder to rebuild the actual solution, not just its value.

### [deep] How do you handle large inputs and overflow in these problems? {#overflow-q}

**State the size limits first, and pick an approach that fits them.** For example, O(n²) is fine for 5,000 elements but not for a million.

Then watch for these problems:

- **Integer overflow** when adding or multiplying. Use `long`, `Math.addExact`, or `BigInteger` and `BigDecimal` for money.
- **Overflow in `(lo + hi) / 2`.**
- **Deep recursion** on large inputs. Use a loop or an explicit stack instead.
- **Data that does not fit in memory.** Consider processing it as a stream.

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

How it works:

- The brute force checks all pairs, in O(n²).
- The map remembers earlier values, so each number needs only one O(1) lookup.
- The code checks before it inserts, so a number cannot be paired with itself.
- The total is O(n) time and O(n) space. For a sorted array, two pointers need only O(1) space.

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

How it works:

- The window `[left, right]` always holds characters that are all different.
- When a character repeats inside the window, `left` jumps just past its earlier position.
- Each index is visited once, so the time is O(n).
- The map holds at most one entry per letter of the alphabet.

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

How it works:

- After sorting by start, overlapping intervals sit next to each other.
- One sweep either extends the last merged interval or starts a new one.
- The sort costs O(n log n) and the sweep costs O(n).
- Intervals that only touch (one ends where the next starts) are merged too, because the check uses `<`.

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

How it works:

- The state `dp[a]` is the fewest coins for amount `a`.
- Each state reuses a smaller one: one coin plus the best answer for what is left.
- The base case is `dp[0] = 0`.
- The time is O(amount times the number of coins), and the space is O(amount).
- A greedy approach (always take the largest coin) fails for some coin sets. With coins 1, 3 and 4 and amount 6, greedy gives 4 + 1 + 1 (three coins), but 3 + 3 (two coins) is better.

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

How it works:

- It follows the pattern choose, explore, undo.
- The result is copied, because `current` keeps changing.
- There are 2ⁿ subsets, so the time is O(n times 2ⁿ).
- To handle duplicates, sort first and skip equal neighbours.
