// Frame data for the "Coding interview patterns" walk-through (array stage).
// A frame is { note, rows: [{ label, cells, pointers }] }. A cell is a value or { v, tone }.
// tone: none | ok | bad | warn | new | dim. A pointer is { name, at, tone }.

const cells = (vals, tones = {}) => vals.map((v, i) => ({ v, tone: typeof tones === 'function' ? tones(i) : tones[i] }));
const range = (from, to, tone) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [from + k, tone]));
const row = (label, vals, tones, pointers) => ({ label, cells: cells(vals, tones), pointers });

const SORTED = [1, 3, 4, 6, 8, 11];
const NUMS = [2, 1, 5, 1, 3, 2, 9, 1];
const WINDOW_SUMS = [8, 7, 9, 6, 14, 12];
const PRICES = [3, 1, 4, 1, 5, 9, 2, 6];
const PREFIX = [0, 3, 4, 8, 9, 14, 23, 25, 31];
const DP = [0, 1, 1, 2, 2, 1, 2, 2, 3, 3, 2, 3];

// the dp row with only the first `n` entries filled in
const dpRow = (n, tones, pointers) => row('fewest coins to make each amount', DP.map((v, i) => (i < n ? v : '?')), tones, pointers);

export const CODING_PATTERN_SCENES = [
  {
    id: 'two-pointers',
    label: 'Two pointers',
    title: 'Two pointers close in on the answer in one pass',
    frames: [
      {
        note: 'Task: in a sorted array, find two numbers that add up to 10. Checking every pair is O(n squared). Because the array is sorted, two pointers can do it in one pass: l starts at the smallest value and r at the largest.',
        rows: [row('sorted array, target = 10', SORTED, { 0: 'new', 5: 'new' }, [{ name: 'l', at: 0 }, { name: 'r', at: 5 }])],
      },
      {
        note: '1 + 11 = 12 is too big. The only way to get a smaller sum is to use a smaller right-hand number, so move r left. We can safely discard 11: it is too large with the smallest partner, so it is too large with every other partner as well.',
        rows: [row('sum = 12, too big', SORTED, { 0: 'new', 5: 'dim' }, [{ name: 'l', at: 0 }, { name: 'r', at: 5, tone: 'bad' }])],
      },
      {
        note: '1 + 8 = 9 is too small, so a larger left-hand number is needed. Move l right and discard 1.',
        rows: [row('sum = 9, too small', SORTED, { 0: 'dim', 4: 'new', 5: 'dim' }, [{ name: 'l', at: 0, tone: 'warn' }, { name: 'r', at: 4 }])],
      },
      {
        note: '3 + 8 = 11 is too big again, so r moves left to 6. Then 3 + 6 = 9 is too small, so l moves right to 4.',
        rows: [row('sum = 9, too small', SORTED, { 0: 'dim', 1: 'new', 3: 'new', 4: 'dim', 5: 'dim' }, [{ name: 'l', at: 1, tone: 'warn' }, { name: 'r', at: 3 }])],
      },
      {
        note: '4 + 6 = 10. Found. Each step moved one pointer inward, so there are at most n steps in total: O(n) time and O(1) memory. The same idea solves: reverse an array, check a palindrome, remove duplicates in place, merge two sorted arrays, and three-sum (fix one number, then use two pointers).',
        rows: [row('sum = 10, found', SORTED, { 0: 'dim', 1: 'dim', 2: 'ok', 3: 'ok', 4: 'dim', 5: 'dim' }, [{ name: 'l', at: 2, tone: 'ok' }, { name: 'r', at: 3, tone: 'ok' }])],
      },
    ],
  },
  {
    id: 'window',
    label: 'Sliding window',
    title: 'A sliding window updates its answer instead of recomputing it',
    frames: [
      {
        note: 'Task: find the largest sum of any three consecutive numbers. Adding three numbers for every start position is O(n times k). A sliding window keeps a running sum. The first window covers positions 0 to 2 and its sum is 8.',
        rows: [row('array, window size 3', NUMS, range(0, 2, 'new'), [{ name: 'window', at: 1 }]), row('sum of the window starting at each index', WINDOW_SUMS.map((v, i) => (i === 0 ? v : '')), { 0: 'ok' }, [])],
      },
      {
        note: 'Slide the window one step to the right: add the number that enters (1) and subtract the one that leaves (2). The sum is 8 + 1 - 2 = 7. We did not add the whole window again, just two operations.',
        rows: [row('array, window size 3', NUMS, { 0: 'dim', ...range(1, 3, 'new') }, [{ name: 'window', at: 2 }]), row('sum of the window starting at each index', WINDOW_SUMS.map((v, i) => (i <= 1 ? v : '')), { 0: 'ok', 1: 'ok' }, [])],
      },
      {
        note: 'Slide again: enter 3, leave 1, so the sum is 7 + 3 - 1 = 9, then 6 for the next window. Each slide costs O(1).',
        rows: [row('array, window size 3', NUMS, { 0: 'dim', 1: 'dim', 2: 'dim', ...range(3, 5, 'new') }, [{ name: 'window', at: 4 }]), row('sum of the window starting at each index', WINDOW_SUMS.map((v, i) => (i <= 3 ? v : '')), { 0: 'ok', 1: 'ok', 2: 'ok', 3: 'ok' }, [])],
      },
      {
        note: 'The next window holds 3, 2, 9 and its sum is 6 + 9 - 1 = 14, the best so far. The last window gives 12. The answer is 14, found in one pass: O(n) time, O(1) memory.',
        rows: [row('array, window size 3', NUMS, { 0: 'dim', 1: 'dim', 2: 'dim', 3: 'dim', ...range(4, 6, 'ok'), 7: 'dim' }, [{ name: 'best window', at: 5, tone: 'ok' }]), row('sum of the window starting at each index', WINDOW_SUMS, { 4: 'ok' }, [])],
      },
    ],
  },
  {
    id: 'prefix',
    label: 'Prefix sums',
    title: 'Precompute running totals to answer range questions in O(1)',
    frames: [
      {
        note: 'Task: answer many questions of the form "what is the total of the daily amounts from day i to day j?". Adding the range each time costs O(n) per question. Instead precompute a prefix sum array once.',
        rows: [row('daily amounts', PRICES, {}, [])],
      },
      {
        note: 'prefix[i] is the sum of the first i amounts, so prefix[0] = 0, prefix[1] = 3, prefix[2] = 3 + 1 = 4, and so on. Each value is the previous value plus one amount, so building the array is O(n).',
        rows: [row('daily amounts', PRICES, {}, []), row('prefix sums (prefix[i] = sum of the first i)', PREFIX, {}, [])],
      },
      {
        note: 'The total of positions 2 to 5 is prefix[6] - prefix[2] = 23 - 4 = 19. Everything before position 2 is subtracted from everything up to position 5. Each question is now O(1), after O(n) preparation.',
        rows: [row('daily amounts', PRICES, range(2, 5, 'new'), []), row('prefix sums', PREFIX, { 2: 'warn', 6: 'ok' }, [{ name: 'minus', at: 2, tone: 'warn' }, { name: 'end', at: 6, tone: 'ok' }])],
      },
    ],
  },
  {
    id: 'dp',
    label: 'Dynamic programming',
    title: 'Dynamic programming reuses answers to smaller problems',
    frames: [
      {
        note: 'Task: with coins of 1, 2 and 5, what is the fewest coins that make 11? Trying every combination grows exponentially. Dynamic programming solves it by building up from small amounts. dp[a] is the fewest coins for amount a. With no amount left, dp[0] = 0.',
        rows: [dpRow(1, { 0: 'ok' }, [])],
      },
      {
        note: 'For each amount, try every coin: the answer is 1 + dp[amount - coin], taking the best coin. dp[1] = 1 (a 1 coin), dp[2] = 1 (a 2 coin), dp[3] = 2 (2 + 1), dp[4] = 2 (2 + 2). Each answer reuses an earlier one.',
        rows: [dpRow(5, range(0, 4, 'ok'), [])],
      },
      {
        note: 'dp[5] = 1, because one coin of 5 leaves dp[0] = 0. For 7 we try each coin: coin 1 gives dp[6] + 1 = 3, coin 2 gives dp[5] + 1 = 2, coin 5 gives dp[2] + 1 = 2. The minimum is 2 (5 + 2).',
        rows: [dpRow(8, { ...range(0, 6, 'ok'), 7: 'new' }, [{ name: 'dp[7]', at: 7 }])],
      },
      {
        note: 'Continuing, dp[10] = 2 (5 + 5) and dp[11] = 3: coin 5 gives dp[6] + 1 = 3, coin 2 gives dp[9] + 1 = 4, coin 1 gives dp[10] + 1 = 3. The answer is 3 coins (5 + 5 + 1). The array has n + 1 entries and we try each coin for each entry: O(amount times coins).',
        rows: [dpRow(12, { ...range(0, 10, 'ok'), 11: 'new' }, [{ name: 'answer', at: 11, tone: 'ok' }])],
      },
    ],
  },
];
