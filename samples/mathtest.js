YUI({ logInclude: {TestRunner: true }}).use('test', 'test-console', function (Y) {
    'use strict';
    var testCase = new Y.Test.Case({
        name: "TestCase Name",
        setUp: function () {
        },
        tearDown: function () {
        },
        testfactorial: function () {
           var n;
           Y.assert.areEqual( "", factorial(n),  "factorial should be X");
        },
        testchoose: function () {
           var m, n;
           Y.assert.areEqual( "", choose(m, n),  "choose should be X");
        },
        testbirthday: function () {
           var n;
           Y.assert.areEqual( "", birthday(n),  "birthday should be X");
        }
    });
    Y.Test.Runner.add(testCase);
    (new Y.Test.Console({
        newestOnTop: false
    })).render('#log');
    Y.Test.Runner.run();
});
