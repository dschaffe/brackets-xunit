// some math/statistics functions to demo xUnit

// calculate the fibonacci sequence recursively
// e.g. fibonacci(11) = 89
function fibonacci(n) {
    'use strict';
    if (n < 3) {
        return 1;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}
// calculate factorial of n, commonly denoted as n!
// e.g. factorial(5) = 5 * 4 * 3 * 2 * 1 = 120
function factorial(n) {
    'use strict';
    if (n < 1) {
        return 1;
    } else {
        return n * factorial(n - 1);
    }
}
// calculate the number of unordered combinations
// m choose n is the number of combinations of m objects n at a time
// e.g. choose(5,2) is 10 (a,b,c,d,e) = (a,b) (a,c) (a,d) (a,e) (b,c)
//                                      (b,d) (b,e) (c,d) (c,e) (d,e)
function choose(m, n) {
    'use strict';
    return factorial(m) / factorial(m - n) / factorial(n);
}
// calculate the probability a group of n people with randomly 
// distributed birthdays at least two people share the same
// birthday.
// e.g. birthday(32) > 0.5 , (slighty more than .5)
function birthday(n) {
    'use strict';
    var result = 1, i;
    for (i = 0; i < n; i += 1) {
        result = result * (365 - i) / 365;
    }
    return 1 - result;
}
