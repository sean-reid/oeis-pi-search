DROP TABLE IF EXISTS sequences;
DROP TABLE IF EXISTS names_fts;
DROP TABLE IF EXISTS meta;
CREATE TABLE sequences (
  anumber TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  terms TEXT NOT NULL,
  staircase TEXT NOT NULL,
  rows INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  depth_digits INTEGER NOT NULL,
  depth_first INTEGER,
  first3 INTEGER,
  digits3 INTEGER,
  first8 INTEGER,
  has_negative INTEGER NOT NULL,
  pi_digits REAL,
  pi_expr TEXT,
  pi_value REAL
);
CREATE INDEX sequences_deepest ON sequences (depth DESC, depth_digits DESC, depth_first ASC);
CREATE INDEX sequences_earliest ON sequences (first8 ASC) WHERE first8 IS NOT NULL;
CREATE INDEX sequences_rarest ON sequences (digits3 ASC) WHERE first3 IS NULL AND digits3 IS NOT NULL;
CREATE INDEX sequences_pi ON sequences (pi_digits DESC) WHERE pi_digits IS NOT NULL;
CREATE VIRTUAL TABLE names_fts USING fts5(anumber UNINDEXED, name, tokenize='unicode61');
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO sequences (anumber, name, terms, staircase, rows, depth, depth_digits, depth_first, first3, digits3, first8, has_negative, pi_digits, pi_expr, pi_value) VALUES
('A000001', 'Number of groups of order n.', '0,1,1,1,2,1,2,1,5,2,2,1,5,1,2,1,14,1,5,1,5,2,2,1,15,2,2,5,4,1', '[{"k":1,"digits":"0","first":32,"count":1954},{"k":2,"digits":"01","first":167,"count":217},{"k":3,"digits":"011","first":361,"count":25},{"k":4,"digits":"0111","first":19626,"count":1},{"k":5,"digits":"01112","first":null,"count":0},{"k":6,"digits":"011121","first":null,"count":0},{"k":7,"digits":"0111212","first":null,"count":0}]', 7, 4, 4, 19626, 361, 3, NULL, 0, 5.61, '3 + ln(111 / 10^1) / 17', 3.1415850064),
('A000002', 'Kolakoski sequence: a(n) is length of n-th run; a(1) = 1; sequence consists just of 1''s and 2''s.', '1,2,2,1,1,2,1,2,2,1,2,2,1,1,2,1,1,2,2,1,2,1,1,2,1,2,2,1,1,2', '[{"k":1,"digits":"1","first":1,"count":1997},{"k":2,"digits":"12","first":148,"count":187},{"k":3,"digits":"122","first":483,"count":17},{"k":4,"digits":"1221","first":8731,"count":1},{"k":5,"digits":"12211","first":null,"count":0},{"k":6,"digits":"122112","first":null,"count":0},{"k":7,"digits":"1221121","first":null,"count":0}]', 7, 4, 4, 8731, 483, 3, NULL, 0, 4.63, '3 + 17 / 12 / 10^1', 3.1416666667),
('A000040', 'The prime numbers.', '2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113', '[{"k":1,"digits":"2","first":6,"count":1986},{"k":2,"digits":"23","first":16,"count":211},{"k":3,"digits":"235","first":698,"count":25},{"k":4,"digits":"2357","first":15070,"count":1},{"k":5,"digits":"235711","first":null,"count":0}]', 5, 4, 4, 15070, 698, 3, NULL, 0, 4.35, '4 - 26 * log10(2 * 10^3) / 10^2', 3.1417322011),
('A000045', 'Fibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.', '0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711,28657,46368,75025,121393,196418,317811,514229', '[{"k":1,"digits":"0","first":32,"count":1954},{"k":2,"digits":"01","first":167,"count":217},{"k":3,"digits":"011","first":361,"count":25},{"k":4,"digits":"0112","first":4448,"count":5},{"k":5,"digits":"01123","first":7143,"count":1},{"k":6,"digits":"011235","first":null,"count":0},{"k":7,"digits":"0112358","first":null,"count":0}]', 7, 5, 5, 7143, 361, 3, NULL, 0, 4.99, '3 + 1123^3 / 10^10', 3.1416247867),
('A000079', 'Powers of 2: a(n) = 2^n.', '1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384,32768,65536,131072,262144,524288,1048576,2097152,4194304,8388608,16777216,33554432,67108864,134217728,268435456,536870912', '[{"k":1,"digits":"1","first":1,"count":1997},{"k":2,"digits":"12","first":148,"count":187},{"k":3,"digits":"124","first":1080,"count":14},{"k":4,"digits":"1248","first":18381,"count":1},{"k":5,"digits":"124816","first":null,"count":0}]', 5, 4, 4, 18381, 1080, 3, NULL, 0, 6.36, '3 + 1248^2 / 11 / 10^6', 3.1415912727),
('A000108', 'Catalan numbers: C(n) = binomial(2n,n)/(n+1) = (2n)!/(n!(n+1)!).', '1,1,2,5,14,42,132,429,1430,4862,16796,58786,208012,742900,2674440,9694845,35357670,129644790,477638700,1767263190,6564120420,24466267020,91482563640,343059613650,1289904147324,4861946401452,18367353072152,69533550916004,263747951750360,1002242216651368', '[{"k":1,"digits":"1","first":1,"count":1997},{"k":2,"digits":"11","first":94,"count":198},{"k":3,"digits":"112","first":709,"count":26},{"k":4,"digits":"1125","first":1349,"count":3},{"k":5,"digits":"112514","first":null,"count":0}]', 5, 4, 4, 1349, 709, 3, NULL, 0, 4.32, '3 + 112^(1/4) / 23', 3.1414414401),
('A000142', 'Factorial numbers: n! = 1*2*3*4*...*n (order of symmetric group S_n, number of permutations of n letters).', '1,1,2,6,24,120,720,5040,40320,362880,3628800,39916800,479001600,6227020800,87178291200,1307674368000,20922789888000,355687428096000,6402373705728000,121645100408832000,2432902008176640000,51090942171709440000,1124000727777607680000', '[{"k":1,"digits":"1","first":1,"count":1997},{"k":2,"digits":"11","first":94,"count":198},{"k":3,"digits":"112","first":709,"count":26},{"k":4,"digits":"1126","first":12702,"count":3},{"k":5,"digits":"112624","first":null,"count":0}]', 5, 4, 4, 12702, 709, 3, NULL, 0, 5.25, '2 + 9 * 112624^2 / 10^11', 3.1415748838),
('A000217', 'Triangular numbers: a(n) = binomial(n+1,2) = n*(n+1)/2 = 0 + 1 + 2 + ... + n.', '0,1,3,6,10,15,21,28,36,45,55,66,78,91,105,120,136,153,171,190,210,231,253,276,300,325,351,378,406,435', '[{"k":1,"digits":"0","first":32,"count":1954},{"k":2,"digits":"01","first":167,"count":217},{"k":3,"digits":"013","first":2079,"count":23},{"k":4,"digits":"0136","first":2079,"count":4},{"k":5,"digits":"013610","first":null,"count":0}]', 5, 4, 4, 2079, 2079, 3, NULL, 0, 4.80, '3 + log10(13 * 10^2) / 22', 3.1415428797),
('A000290', 'The squares: a(n) = n^2.', '0,1,4,9,16,25,36,49,64,81,100,121,144,169,196,225,256,289,324,361,400,441,484,529,576,625,676,729,784,841', '[{"k":1,"digits":"0","first":32,"count":1954},{"k":2,"digits":"01","first":167,"count":217},{"k":3,"digits":"014","first":669,"count":24},{"k":4,"digits":"0149","first":3134,"count":2},{"k":5,"digits":"014916","first":null,"count":0}]', 5, 4, 4, 3134, 669, 3, NULL, 0, 4.24, '3 + cbrt(14) / 17', 3.1417730744),
('A000796', 'Decimal expansion of Pi (or digits of Pi).', '3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,3,2,3,8,4,6,2,6,4,3,3,8,3,2,7', '[{"k":1,"digits":"3","first":9,"count":1986},{"k":2,"digits":"31","first":137,"count":178},{"k":3,"digits":"314","first":2120,"count":23},{"k":4,"digits":"3141","first":3496,"count":1},{"k":5,"digits":"31415","first":null,"count":0},{"k":6,"digits":"314159","first":null,"count":0},{"k":7,"digits":"3141592","first":null,"count":0}]', 7, 4, 4, 3496, 2120, 3, NULL, 0, NULL, NULL, NULL),
('A001057', 'Canonical enumeration of integers: interleaved positive and negative integers with zero prepended.', '0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8,-8,9,-9,10,-10,11,-11,12,-12,13,-13,14,-14,15', '[{"k":1,"digits":"0","first":32,"count":1954},{"k":2,"digits":"01","first":167,"count":217},{"k":3,"digits":"011","first":361,"count":25},{"k":4,"digits":"0112","first":4448,"count":5},{"k":5,"digits":"01122","first":null,"count":0},{"k":6,"digits":"011223","first":null,"count":0},{"k":7,"digits":"0112233","first":null,"count":0}]', 7, 4, 4, 4448, 361, 3, NULL, 1, 5.63, '28 * 1122 / 10^4', 3.1416000000),
('A005132', 'Recamán''s sequence (or Recaman''s sequence): a(0) = 0; for n > 0, a(n) = a(n-1) - n if nonnegative and not already in the sequence, otherwise a(n) = a(n-1) + n.', '0,1,3,6,2,7,13,20,12,21,11,22,10,23,9,24,8,25,43,62,42,63,41,18,42,17,43,16,44,15', '[{"k":1,"digits":"0","first":32,"count":1954},{"k":2,"digits":"01","first":167,"count":217},{"k":3,"digits":"013","first":2079,"count":23},{"k":4,"digits":"0136","first":2079,"count":4},{"k":5,"digits":"01362","first":null,"count":0},{"k":6,"digits":"013627","first":null,"count":0}]', 6, 4, 4, 2079, 2079, 3, NULL, 0, 4.80, '3 + log10(13 * 10^2) / 22', 3.1415428797),
('A005150', 'Look and Say sequence: describe the previous term! (method A - initial term is 1).', '1,11,21,1211,111221,312211,13112221,1113213211,31131211131221,13211311123113112211,11131221133112132113212221,3113112221232112111312211312113211,1321132132111213122112311311222113111221131221,11131221131211131231121113112221121321132132211331222113112211,311311222113111231131112132112311321322112111312211312111322212311322113212221', '[{"k":1,"digits":"1","first":1,"count":1997},{"k":2,"digits":"111","first":153,"count":20},{"k":3,"digits":"11121","first":null,"count":0}]', 3, 2, 3, 153, NULL, 5, NULL, 0, 5.61, '3 + ln(111 / 10^1) / 17', 3.1415850064);
INSERT INTO names_fts (anumber, name) VALUES
('A000001', 'Number of groups of order n.'),
('A000002', 'Kolakoski sequence: a(n) is length of n-th run; a(1) = 1; sequence consists just of 1''s and 2''s.'),
('A000040', 'The prime numbers.'),
('A000045', 'Fibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.'),
('A000079', 'Powers of 2: a(n) = 2^n.'),
('A000108', 'Catalan numbers: C(n) = binomial(2n,n)/(n+1) = (2n)!/(n!(n+1)!).'),
('A000142', 'Factorial numbers: n! = 1*2*3*4*...*n (order of symmetric group S_n, number of permutations of n letters).'),
('A000217', 'Triangular numbers: a(n) = binomial(n+1,2) = n*(n+1)/2 = 0 + 1 + 2 + ... + n.'),
('A000290', 'The squares: a(n) = n^2.'),
('A000796', 'Decimal expansion of Pi (or digits of Pi).'),
('A001057', 'Canonical enumeration of integers: interleaved positive and negative integers with zero prepended.'),
('A005132', 'Recamán''s sequence (or Recaman''s sequence): a(0) = 0; for n > 0, a(n) = a(n-1) - n if nonnegative and not already in the sequence, otherwise a(n) = a(n-1) + n.'),
('A005150', 'Look and Say sequence: describe the previous term! (method A - initial term is 1).');
INSERT INTO meta (key, value) VALUES ('snapshot', '2026-09-04'), ('digits', '20000'), ('maxQuery', '7'), ('sequences', '13');
