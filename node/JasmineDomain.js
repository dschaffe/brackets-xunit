/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 * brackets-jasmine - a brackets plugin to run jasmine unit tests
 */
 
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, global, jasmine, require, process, __dirname, exports */
(function () {
    "use strict";

    var domainManager = null,
        util,
        Path = require('path'),
        fs = require('fs');

    var jasmine = require('./node_modules/jasmine-node/lib/jasmine-node/index');

    try {
        util = require('util');
    } catch (e) {
        util = require('sys');
    }

    var specFolder = null;

    // The following line keeps the jasmine setTimeout in the proper scope
    jasmine.setTimeout = jasmine.getGlobal().setTimeout;
    jasmine.setInterval = jasmine.getGlobal().setInterval;
    var key;
    for (key in jasmine) {
        if (jasmine.hasOwnProperty(key) && key !== 'undefined') {
            global[key] = jasmine[key];
        }
    }
    var exitCode = 0;
    var isVerbose = true;
    var showColors = true;
    var teamcity = process.env.TEAMCITY_PROJECT_NAME || false;
    var useRequireJs = false;
    var extentions = "js";
    var match = '.';
    var matchall = true;
    var autotest = false;
    var useHelpers = true;
    var captureExceptions = false;
    var results = [];
    var junitreport = {
        report: true,
        savePath : __dirname + "/reports/",
        useDotNotation: true,
        consolidate: true
    };

    var existsSync = fs.existsSync || Path.existsSync;
    var regExpSpec = new RegExp(match + (matchall ? "" : "spec\\.") + "(" + extentions + ")$", 'i');

    var options = {
        specFolder:   specFolder,
        isVerbose:    isVerbose,
        showColors:   showColors,
        teamcity:     teamcity,
        useRequireJs: useRequireJs,
        regExpSpec:   regExpSpec,
        junitreport:  junitreport
    };

    

    function readXmlResults(reportdir, callback) {
        var files = fs.readdirSync(reportdir);
        var resultCount = 0;
        var results = [];
        var parseString = require('xml2js').parseString;
        var i;
        function parseStringDone(err, result) {
            results[results.length] = result;
            if (results.length === files.length) {
                callback(results);
            }
        }
        for (i = 0; i < files.length; i++) {
            var file = reportdir + "/" + files[i];
            var xml = fs.readFileSync(file);
            parseString(xml, parseStringDone);
        }
        if (files.length === 0) {
            domainManager.emitEvent("jasmine", "update", "Error: Jasmine test did not produce any results.  Check the test for possible errors.");
        }
    }

    options.onComplete = function () {
        readXmlResults(junitreport.savePath, function (resultxml) {
            var i, j;
            results = [];
            for (i = 0; i < resultxml.length; i++) {
                if (resultxml !== undefined && resultxml[i] !== undefined) {
                    var result = {};
                    result.path = options.specFolder;
                    result.title = result.path;
                    if (result.title[result.title.length - 1] === '/') {
                        result.title = result.title.substring(0, result.title.length - 1);
                    }
                    result.title = result.title.substring(result.title.lastIndexOf('/') + 1);
                    result.name = resultxml[i].testsuites.testsuite[0].$.name;
                    result.errors = resultxml[i].testsuites.testsuite[0].$.errors;
                    result.failures = resultxml[i].testsuites.testsuite[0].$.failures;
                    result.time = resultxml[i].testsuites.testsuite[0].$.time;
                    result.timestamp = resultxml[i].testsuites.testsuite[0].$.timestamp;
                    result.testcases = [];
                    var testcases = resultxml[i].testsuites.testsuite[0].testcase;
                    for (j = 0; j < testcases.length; j++) {
                        var currenttestcase = testcases[j];
                        result.testcases[j] = {};
                        result.testcases[j].name = currenttestcase.$.name;
                        result.testcases[j].time = currenttestcase.$.time;
                        if (currenttestcase.hasOwnProperty('failure')) {
                            result.testcases[j].failure = currenttestcase.failure[0];
                        }
                    }
                    results[results.length] = result;
                }
            }
            domainManager.emitEvent("jasmine", "update", JSON.stringify(results));
        });
    };

    function cleanResults(reportdir) {
        if (fs.existsSync(reportdir)) {
            var files = fs.readdirSync(reportdir);
            var i;
            for (i = 0; i < files.length; i++) {
                fs.unlinkSync(reportdir + "/" + files[i]);
            }
        } else {
            fs.mkdir(reportdir);
        }
    }

    function runTest(path) {
        cleanResults(junitreport.savePath);
        results = [];
        options.specFolder = path;
        jasmine.getEnv().currentRunner_.suites_ = [];
        jasmine.getEnv().reporter.subReporters_ = [];
        jasmine.executeSpecsInFolder(options);
    }


    function init(DomainManager) {
        domainManager = DomainManager;
        if (!domainManager.hasDomain("jasmine")) {
            domainManager.registerDomain("jasmine", {major: 0, minor: 1});
        }

        domainManager.registerCommand(
            "jasmine",
            "runTest",
            runTest,
            false,
            "Runs jasmine test on a file",
            ["file"],
            []
        );
        domainManager.registerEvent(
            "jasmine",
            "update",
            ["data"]
        );
    }

    exports.init = init;
}());