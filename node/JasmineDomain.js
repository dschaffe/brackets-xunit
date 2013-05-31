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
 * brackets-xunit - a brackets plugin to run unit tests
 */
 
/*jslint nomen: true, indent: 4, maxerr: 50, node: true */
/*global define, brackets, $, global */

// runs Jasmine Node tests
(function () {
    "use strict";

    var jasmine = require('./node_modules/jasmine-node/lib/jasmine-node/index'), // load jasmine harness
        Path = require('path'),
        fs = require('fs'),
        domainManager = null,
        exitCode = 0,
        extentions = "js",
        match = '.',
        matchall = true,
        autotest = false,
        useHelpers = true,
        captureExceptions = false,
        results = [],
        existsSync = fs.existsSync || Path.existsSync,
        specFolder = null,
        isVerbose = true,
        showColors = true,
        teamcity = process.env.TEAMCITY_PROJECT_NAME || false,
        useRequireJs = false,
        regExpSpec = new RegExp(match + (matchall ? "" : "spec\\.") + "(" + extentions + ")$", 'i'),
        junitreport = {
            report: true,
            savePath : __dirname + "/reports/",
            useDotNotation: true,
            consolidate: true
        },
        options = {
            specFolder:   specFolder,
            isVerbose:    isVerbose,
            showColors:   showColors,
            teamcity:     teamcity,
            useRequireJs: useRequireJs,
            regExpSpec:   regExpSpec,
            junitreport:  junitreport
        },
        key,
        util;


    try {
        util = require('util');
    } catch (e) {
        util = require('sys');
    }

    // The following line keeps the jasmine setTimeout in the proper scope
    jasmine.setTimeout = jasmine.getGlobal().setTimeout;
    jasmine.setInterval = jasmine.getGlobal().setInterval;
    for (key in jasmine) {
        if (jasmine.hasOwnProperty(key) && key !== 'undefined') {
            global[key] = jasmine[key];
        }
    }

    function readXmlResults(reportdir, callback) {
        var files = fs.readdirSync(reportdir),
            resultCount = 0,
            results = [],
            parseString = require('xml2js').parseString,
            file,
            xml,
            i;
        function parseStringDone(err, result) {
            results[results.length] = result;
            if (results.length === files.length) {
                callback(results);
            }
        }
        for (i = 0; i < files.length; i += 1) {
            file = reportdir + "/" + files[i];
            xml = fs.readFileSync(file);
            parseString(xml, parseStringDone);
        }
        if (files.length === 0) {
            domainManager.emitEvent("jasmine", "update", "Error: Jasmine test did not produce any results.  Check the test for possible errors.");
        }
    }

    options.onComplete = function () {
        readXmlResults(junitreport.savePath, function (resultxml) {
            var i, j, result, testcases, currenttestcase;
            results = [];
            for (i = 0; i < resultxml.length; i += 1) {
                if (resultxml !== undefined && resultxml[i] !== undefined) {
                    result = {};
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
                    testcases = resultxml[i].testsuites.testsuite[0].testcase;
                    for (j = 0; j < testcases.length; j += 1) {
                        currenttestcase = testcases[j];
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
        var files, i;
        if (fs.existsSync(reportdir)) {
            files = fs.readdirSync(reportdir);
            for (i = 0; i < files.length; i += 1) {
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