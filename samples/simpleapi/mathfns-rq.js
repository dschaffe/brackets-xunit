/*global define */
define(function (require, exports, module) {
    'use strict';
    function fibonacci(n) {
        if (n < 3) {
            return 1;
        } else {
            return fibonacci(n - 1) + fibonacci(n - 2);
        }
    }
    function factorial(n) {
        if (n < 1) {
            return 1;
        } else {
            return n * factorial(n - 1);
        }
    }
    function choose(m, n) {
        return factorial(m) / factorial(m - n) / factorial(n);
    }
    function birthday(n) {
        var result = 1, i;
        for (i = 0; i < n; i += 1) {
            result = result * (365 - i) / 365;
        }
        return 1 - result;
    }
    exports.fibonacci = fibonacci;
    exports.factorial = factorial;
    exports.choose = choose;
    exports.birthday = birthday;
});