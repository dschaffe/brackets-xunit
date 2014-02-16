YUI({ logInclude: {TestRunner: true }}).use('test', 'test-console', function (Y) {
    'use strict';
    var testCase = new Y.Test.Case({
        name: "TestCase Name",
        setUp: function () {
            this.data = { name : 'Nicholas', age : 28 };
        },
        tearDown: function () {
            delete this.data;
        },
        testName: function () {
            Y.Assert.areEqual("Nicholas", this.data.name, "Name should be 'Nicholas'");
        },
        testAge: function () {
            Y.Assert.areEqual(28, this.data.age, "Age should be 28");
        },
        testAgeWrongly: function () {
            Y.Assert.areEqual(27, this.data.age, "Age should be not 27");
        }
    });
    
    Y.Test.Runner.add(testCase);
    (new Y.Test.Console({
        newestOnTop: false
    })).render('#log');
    
    Y.Test.Runner.run();
    
});
