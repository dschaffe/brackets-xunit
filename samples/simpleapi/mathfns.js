function fibonacci(n) {
    'use strict';
    if (n < 3) {
        return 1;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}
function factorial(n) {
    'use strict';
    if (n < 1) {
        return 1;
    } else {
        return n * factorial(n - 1);
    }
}
function choose(m, n) {
    'use strict';
    return factorial(m) / factorial(m - n) / factorial(n);
}
function birthday(n) {
    'use strict';
    var result = 1, i;
    for (i = 0; i < n; i += 1) {
        result = result * (365 - i) / 365;
    }
    return 1 - result;
}
