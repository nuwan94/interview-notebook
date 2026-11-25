// Frame data for the "Coding interview patterns" walk-through (array stage).
// A frame is { line, result, note, rows: [{ label, cells, pointers, spans }] }. A cell is a value or { v, tone }.
// tone: none | ok | bad | warn | new | dim. A pointer is { name, at, tone }. A span is a bracket { name, from, to, tone }.

const cells = (vals, tones = {}) => vals.map((v, i) => ({ v, tone: typeof tones === 'function' ? tones(i) : tones[i] }));
const range = (from, to, tone) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [from + k, tone]));
const row = (label, vals, tones, pointers, extra = {}) => ({ label, cells: cells(vals, tones), pointers, ...extra });
const span = (name, from, to, tone) => ({ name, from, to, tone });

const SORTED = [1, 3, 4, 6, 8, 11];
const NUMS = [2, 1, 5, 1, 3, 2, 9, 1];
const WINDOW_SUMS = [8, 7, 9, 6, 14, 12];
const PRICES = [3, 1, 4, 1, 5, 9, 2, 6];
const PREFIX = [0, 3, 4, 8, 9, 14, 23, 25, 31];
const DP = [0, 1, 1, 2, 2, 1, 2, 2, 3, 3, 2, 3];

const SUMS_LABEL = 'sum of the window that starts at each index';
// the dp row with only the first `n` entries filled in
const dpRow = (n, tones, pointers) => row('dp[a] = fewest coins to make amount a', DP.map((v, i) => (i < n ? v : '?')), tones, pointers);

export const CODING_PATTERN_SCENES = [
  {
    id: 'two-pointers',
    label: 'Two pointers',
    title: 'Two pointers close in on the answer in one pass',
    frames: [
      {
        line: 'int l = 0, r = a.length - 1;',
        note: 'Task: in a sorted array, find two numbers that add up to 10. Checking every pair is O(n²). Because the array is sorted, two pointers can do it in one pass. l starts at the smallest value and r at the largest.',
        rows: [row('sorted array, target = 10', SORTED, { 0: 'new', 5: 'new' }, [{ name: 'l', at: 0 }, { name: 'r', at: 5 }])],
      },
      {
        line: 'if (sum > target) r--;',
        result: { text: '1 + 11 = 12: too big', tone: 'bad' },
        note: '1 + 11 = 12 is too big. The only way to get a smaller sum is a smaller right-hand number, so move r left. We can safely drop 11: it is too large even with the smallest partner, so it is too large with every partner.',
        rows: [row('sorted array, target = 10', SORTED, { 0: 'new', 5: 'dim' }, [{ name: 'l', at: 0 }, { name: 'r', at: 5, tone: 'bad' }])],
      },
      {
        line: 'if (sum < target) l++;',
        result: { text: '1 + 8 = 9: too small', tone: 'warn' },
        note: '1 + 8 = 9 is too small, so we need a larger left-hand number. Move l right, and drop 1.',
        rows: [row('sorted array, target = 10', SORTED, { 0: 'dim', 4: 'new', 5: 'dim' }, [{ name: 'l', at: 0, tone: 'warn' }, { name: 'r', at: 4 }])],
      },
      {
        line: 'r--;  then  l++;',
        result: { text: '3 + 8 = 11, then 3 + 6 = 9', tone: 'warn' },
        note: '3 + 8 = 11 is too big again, so r moves left to 6. Then 3 + 6 = 9 is too small, so l moves right to 4.',
        rows: [row('sorted array, target = 10', SORTED, { 0: 'dim', 1: 'new', 3: 'new', 4: 'dim', 5: 'dim' }, [{ name: 'l', at: 1, tone: 'warn' }, { name: 'r', at: 3 }])],
      },
      {
        line: 'if (sum == target) return new int[] { l, r };',
        result: { text: '4 + 6 = 10: found', tone: 'ok' },
        note: '4 + 6 = 10, so the pair is found. Each step moved one pointer inwards, so there are at most n steps: O(n) time and O(1) memory. The same idea solves other tasks: reverse an array, check a palindrome, remove duplicates in place, merge two sorted arrays, and three-sum (fix one number, then use two pointers).',
        rows: [row('sorted array, target = 10', SORTED, { 0: 'dim', 1: 'dim', 2: 'ok', 3: 'ok', 4: 'dim', 5: 'dim' }, [{ name: 'l', at: 2, tone: 'ok' }, { name: 'r', at: 3, tone: 'ok' }])],
      },
    ],
  },
  {
    id: 'window',
    label: 'Sliding window',
    title: 'A sliding window updates its answer instead of recomputing it',
    frames: [
      {
        line: 'int sum = a[0] + a[1] + a[2];',
        result: { text: 'sum = 8', tone: 'new' },
        note: 'Task: find the largest sum of three numbers in a row. Adding up three numbers for every start position is O(n × k), for a window of size k. A sliding window keeps a running sum instead. The first window covers positions 0 to 2, and its sum is 8.',
        rows: [
          row('array, window size 3', NUMS, range(0, 2, 'new'), [], { spans: [span('window', 0, 2)] }),
          row(SUMS_LABEL, WINDOW_SUMS.map((v, i) => (i === 0 ? v : '')), { 0: 'ok' }, []),
        ],
      },
      {
        line: 'sum += a[right] - a[right - 3];',
        result: { text: '8 + 1 - 2 = 7', tone: 'new' },
        note: 'Slide the window one step to the right. Add the number that enters (1) and subtract the one that leaves (2). The sum is 8 + 1 - 2 = 7. We did not add up the whole window again, just two operations.',
        rows: [
          row('array, window size 3', NUMS, { 0: 'dim', ...range(1, 3, 'new') }, [], { spans: [span('window', 1, 3)] }),
          row(SUMS_LABEL, WINDOW_SUMS.map((v, i) => (i <= 1 ? v : '')), { 0: 'ok', 1: 'ok' }, []),
        ],
      },
      {
        line: 'sum += a[right] - a[right - 3];',
        result: { text: '7 + 3 - 1 = 9, then 6', tone: 'new' },
        note: 'Slide again. 3 enters and 1 leaves, so the sum is 7 + 3 - 1 = 9. The next window gives 6. Each slide costs O(1).',
        rows: [
          row('array, window size 3', NUMS, { 0: 'dim', 1: 'dim', 2: 'dim', ...range(3, 5, 'new') }, [], { spans: [span('window', 3, 5)] }),
          row(SUMS_LABEL, WINDOW_SUMS.map((v, i) => (i <= 3 ? v : '')), { 0: 'ok', 1: 'ok', 2: 'ok', 3: 'ok' }, []),
        ],
      },
      {
        line: 'best = Math.max(best, sum);',
        result: { text: 'best = 14', tone: 'ok' },
        note: 'The next window holds 3, 2, 9, and its sum is 6 + 9 - 1 = 14, the best so far. The last window gives 12. The answer is 14, found in one pass: O(n) time and O(1) memory.',
        rows: [
          row('array, window size 3', NUMS, { 0: 'dim', 1: 'dim', 2: 'dim', 3: 'dim', ...range(4, 6, 'ok'), 7: 'dim' }, [], { spans: [span('best window', 4, 6, 'ok')] }),
          row(SUMS_LABEL, WINDOW_SUMS, { 4: 'ok' }, []),
        ],
      },
    ],
  },
  {
    id: 'prefix',
    label: 'Prefix sums',
    title: 'Precompute running totals to answer range questions in O(1)',
    frames: [
      {
        line: 'sum(amounts, i, j)  // asked many times',
        note: 'Task: answer many questions like "what is the total of the daily amounts from day i to day j?". Adding up the range each time costs O(n) per question. Instead, compute a prefix sum array once.',
        rows: [row('daily amounts', PRICES, {}, [])],
      },
      {
        line: 'prefix[i + 1] = prefix[i] + a[i];',
        result: { text: 'built once: O(n)', tone: 'ok' },
        note: 'prefix[i] is the sum of the first i amounts. So prefix[0] = 0, prefix[1] = 3, prefix[2] = 3 + 1 = 4, and so on. Each value is the previous value plus one amount, so building the array is O(n).',
        rows: [row('daily amounts', PRICES, {}, []), row('prefix sums: prefix[i] = sum of the first i amounts', PREFIX, {}, [])],
      },
      {
        line: 'prefix[6] - prefix[2]  // days 2 to 5',
        result: { text: '23 - 4 = 19: O(1)', tone: 'ok' },
        note: 'The total of positions 2 to 5 is prefix[6] - prefix[2] = 23 - 4 = 19. The total up to position 5 minus the total before position 2 leaves just the range. Each question is now O(1), after O(n) preparation.',
        rows: [
          row('daily amounts', PRICES, range(2, 5, 'new'), [], { spans: [span('days 2 to 5', 2, 5)] }),
          row('prefix sums', PREFIX, { 2: 'warn', 6: 'ok' }, [{ name: 'minus', at: 2, tone: 'warn' }, { name: 'total', at: 6, tone: 'ok' }]),
        ],
      },
    ],
  },
  {
    id: 'dp',
    label: 'Dynamic programming',
    title: 'Dynamic programming reuses answers to smaller problems',
    frames: [
      {
        line: 'dp[0] = 0;',
        note: 'Task: with coins of 1, 2 and 5, what is the fewest number of coins that make 11? Trying every combination grows exponentially. Dynamic programming builds the answer up from small amounts instead. dp[a] is the fewest coins for amount a. Amount 0 needs no coins, so dp[0] = 0.',
        rows: [dpRow(1, { 0: 'ok' }, [])],
      },
      {
        line: 'dp[a] = 1 + min(dp[a - coin]);',
        result: { text: 'dp[1..4] = 1, 1, 2, 2', tone: 'ok' },
        note: 'For each amount, try every coin. The answer is 1 + dp[amount - coin], using the best coin. dp[1] = 1 (a 1 coin), dp[2] = 1 (a 2 coin), dp[3] = 2 (2 + 1) and dp[4] = 2 (2 + 2). Each answer reuses an earlier one.',
        rows: [dpRow(5, range(0, 4, 'ok'), [])],
      },
      {
        line: 'dp[7] = 1 + min(dp[6], dp[5], dp[2]);',
        result: { text: '1 + min(2, 1, 1) = 2', tone: 'ok' },
        note: 'dp[5] = 1, because one coin of 5 leaves dp[0] = 0. For 7, try each coin. These are the amber cells. Coin 1 leaves 6: dp[6] + 1 = 3. Coin 2 leaves 5: dp[5] + 1 = 2. Coin 5 leaves 2: dp[2] + 1 = 2. The minimum is 2 coins (5 + 2).',
        rows: [dpRow(8, { ...range(0, 6, 'ok'), 2: 'warn', 5: 'warn', 6: 'warn', 7: 'new' }, [{ name: 'dp[7]', at: 7 }])],
      },
      {
        line: 'dp[11] = 1 + min(dp[10], dp[9], dp[6]);',
        result: { text: 'answer: 3 coins (5 + 5 + 1)', tone: 'ok' },
        note: 'Continue the same way. dp[10] = 2 (5 + 5). For dp[11], coin 5 gives dp[6] + 1 = 3, coin 2 gives dp[9] + 1 = 4, and coin 1 gives dp[10] + 1 = 3. The answer is 3 coins. The array has amount + 1 entries, and we try each coin for each entry: O(amount × coins).',
        rows: [dpRow(12, { ...range(0, 10, 'ok'), 6: 'warn', 9: 'warn', 10: 'warn', 11: 'new' }, [{ name: 'answer', at: 11, tone: 'ok' }])],
      },
    ],
  },
];
