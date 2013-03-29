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
 * brackets-xunit - a brackets extension to run various unit test frameworks
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global brackets, define, $, window, Mustache, document */

define(function (require, exports, module) {
    'use strict';

    var AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        Menus               = brackets.getModule("command/Menus"),
        NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager");

    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        jasmineReportEntry  = new NativeFileSystem.FileEntry(moduledir + '/generated/jasmineReport.html'),
        qunitReportEntry    = new NativeFileSystem.FileEntry(moduledir + '/generated/qUnitReport.html'),
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
        TEST262TEST_CMD     = "test262_cmd",
        SCRIPT_CMD          = "script_cmd",
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = new NodeConnection(),
        _windows            = {},
        _times              = {};

    // Execute YUI test
    function runYUI() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var data = { filename : entry.name,
                     title : 'YUI test - ' + entry.name,
                     templatedir : moduledir,
                     contents : DocumentManager.getCurrentDocument().getText()
                   };
        var template = require("text!templates/yui.html");
        var html = Mustache.render(template, data);
        var resultWindow = window.open('about:blank', null, 'width=600,height=200');
        resultWindow.document.write(html);
        resultWindow.focus();
    }
 
    // Execute Jasmine test
    function runJasmine() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1);
        var contents = DocumentManager.getCurrentDocument().getText(),
            includes = '';

        if (contents.match(/brackets-xunit:\s*includes=/)) {
            var includestr = contents.match(/brackets-xunit:\s*includes=[A-Za-z0-9,\._\-\/]*/)[0];
            includestr = includestr.substring(includestr.indexOf('=') + 1);
            var includedata = includestr.split(',');
            var i;
            for (i = 0; i < includedata.length; i++) {
                includes = includes + '<script src="' + dir + includedata[i] + '"></script>\n';
            }
        }
        var data = { filename : entry.name,
                     title : 'Jasmine test - ' + entry.name,
                     includes : includes,
                     contents : DocumentManager.getCurrentDocument().getText()
                   };
        var template = require("text!templates/jasmine.html");
        var html = Mustache.render(template, data);
        FileUtils.writeText(jasmineReportEntry, html).done(function () {
            var report = window.open(jasmineReportEntry.fullPath);
            report.focus();
        });
    }

    // Execute QUnit test
    function runQUnit() {
        var entry = ProjectManager.getSelectedItem();
        var f = entry.fullPath;
        if (entry === null) {
            entry = DocumentManager.getCurrentDocument();
            f = entry.fullPath;
        }
        var fname = DocumentManager.getCurrentDocument().filename;
        var data = { filename : entry.name,
                     title : 'QUnit test - ' + entry.name,
                     templatedir : moduledir,
                     contents : DocumentManager.getCurrentDocument().getText(),
                     testSrcURL: "file://localhost" + f
                   };
        var template = require("text!templates/qunit.html");
        var html = Mustache.render(template, data);
        // write generated test report to file on disk
        FileUtils.writeText(qunitReportEntry, html).done(function () {
            // launch new window with generated report
            var report = window.open(qunitReportEntry.fullPath);
            report.focus();
        });
    }

    // Execute test262 test
    function runTest262() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var path = entry.fullPath;
        var base = path.substring(0, path.lastIndexOf('/test/'));
        var test262 = base + "/tools/packaging/test262.py";
        var test = path.substring(path.indexOf("/suite/") + 7);
        var shell = "/Users/dschaffe/builds/v8/shell";
        nodeConnection.domains.process.spawnSession(test262, ["--full-summary", "--command", shell, test], base).done(function (pid) {
            var template = require("text!templates/process.html");
            var html = Mustache.render(template, { path: test262,
                                                   args: "--full-summary --command " + shell + " " + test,
                                                   title: "test262 - test/suite/" + test});
            var newWindow = window.open("about:blank", null, "width=600,height=200");
            newWindow.document.write(html);
            newWindow.document.getElementById("exitcode").innerHTML = "running with pid " + pid;
            newWindow.focus();
            _windows[pid] = newWindow;
            _times[pid] = new Date();
        });
    }
    // Run File as shell script using node process spawn
    function runScript() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var path = entry.fullPath,
            args = [],
            text = DocumentManager.getCurrentDocument().getText(),
            argsmatch = text.match(/brackets-xunit:\s*args=\S+/);
            
        if (argsmatch !== null && argsmatch.length > 0) {
            var argsstr = argsmatch[0].substring(argsmatch[0].indexOf("=") + 1);
            args = argsstr.split(',');
        }
        nodeConnection.domains.process.spawnSession(path, args, {}).done(function (pid) {
            var template = require("text!templates/process.html");
            var html = Mustache.render(template, { path: path, title: "script - " + path, args: args});
            var newWindow = window.open("about:blank", null, "width=600,height=200");
            newWindow.document.write(html);
            newWindow.focus();
            _windows[pid] = newWindow;
            _times[pid] = new Date();
        });
    }

        // determine if file is test262
    // look at file path for a test directory
    // from the test directory go back one level and look
    // for existance of tools/packaging/test262.py
    // parameter: string of the test file name
    // returns: a deferred object, result will be the base directory from where 
    //          tools/packaging/test262.py can be added to find the python test runner
    function determineTest262FileType(path) {
        if (path.indexOf('/test/') === -1) {
            return undefined;
        }
        var base = path.substring(0, path.lastIndexOf('/test/'));
        var deferred = $.Deferred();
        NativeFileSystem.resolveNativeFileSystemPath(base + '/tools/packaging/test262.py', function (entry) {
            deferred.resolve(base);
        }, function (err) {
            deferred.resolve();
        });
        return deferred.promise();
    }

    // determine if a file is a known test type
    // first look for brackets-xunit: [type], takes precedence
    // next look for distinguishing clues in the file:
    //   YUI: 'YUI(' and 'Test.runner.test'
    //   jasmine: 'describe' and 'it'
    //   QUnit: 'test()' and 'it()'
    //   test262: look at path for test directory then check for 
    //           ../tools/packaging/test262.py
    // todo: unit test this function
    function determineFileType(fileEntry) {
        if (fileEntry) {
            var text = DocumentManager.getCurrentDocument().getText();
            if (text.match(/brackets-xunit:\s*yui/i) !== null) {
                return "yui";
            } else if (text.match(/brackets-xunit:\s*jasmine/i) !== null) {
                return "jasmine";
            } else if (text.match(/brackets-xunit:\s*qunit/i) !== null) {
                return "qunit";
            } else if (text.match(/brackets-xunit:\s*test262/i) !== null) {
                return "test262";
            } else if (text.match(/YUI\s*\(/) && text.match(/Test\.Runner\.run\s*\(/)) {
                return "yui";
            } else if (text.match(/describe\s*\(/) && text.match(/it\s*\(/)) {
                return "jasmine";
            } else if (text.match(/test\s*\(/) && text.match(/ok\s*\(/)) {
                return "qunit";
            } else if (text.match(/^#!/) !== null) {
                return "script";
            }
        }
        return "unknown";
    }

    // converts time in ms to a more readable string format
    // e.g. 1h 10m 30.2s
    function formatTime(ms) {
        var result = "",
            secs = ms / 1000;
        if (secs > 60 * 60 * 24) {
            result = (Math.floor(secs / (60 * 60 * 24))) + "d ";
            secs = secs % (60 * 60 * 24);
        }
        if (secs > 60 * 60) {
            result = result + (Math.floor(secs / (60 * 60))) + "h ";
            secs = secs % (60 * 60);
        }
        if (secs > 60) {
            result = result + (Math.floor(secs / 60)) + "m ";
            secs = secs % 60;
        }
        result = result + Math.round(100 * secs) / 100 + "s";
        return result;
    }
    
    // Register commands as right click menu items
    CommandManager.register("Run YUI Unit Test", YUITEST_CMD, function () {
        runYUI();
    });
    CommandManager.register("Run Jasmine xUnit Test", JASMINETEST_CMD, function () {
        runJasmine();
    });
    CommandManager.register("Run QUnit xUnit Test", QUNITTEST_CMD, function () {
        runQUnit();
    });
    CommandManager.register("Run test262 xUnit Test", TEST262TEST_CMD, function () {
        runTest262();
    });
    CommandManager.register("Run Script", SCRIPT_CMD, function () {
        runScript();
    });

    // Determine type of test for selected item in project
    $(projectMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = ProjectManager.getSelectedItem();
        projectMenu.removeMenuItem(YUITEST_CMD);
        projectMenu.removeMenuItem(JASMINETEST_CMD);
        projectMenu.removeMenuItem(QUNITTEST_CMD);
        projectMenu.removeMenuItem(TEST262TEST_CMD);
        projectMenu.removeMenuItem(SCRIPT_CMD);

        var type = determineFileType(selectedEntry);
        if (type === "yui") {
            projectMenu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            projectMenu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            projectMenu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        } else if (type === "test262") {
            projectMenu.addMenuItem(TEST262TEST_CMD, "", Menus.LAST);
        } else if (type === "script") {
            projectMenu.addMenuItem(SCRIPT_CMD, "", Menus.LAST);
        } else {
            var promise = determineTest262FileType(selectedEntry.fullPath);
            if (promise !== undefined) {
                promise.done(function (path) {
                    if (path !== undefined) {
                        projectMenu.addMenuItem(TEST262TEST_CMD, "", Menus.LAST);
                    }
                });
            }
        }
    });

    // Determine type of test for selected item in working set
    $(workingsetMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = DocumentManager.getCurrentDocument().file;
        workingsetMenu.removeMenuItem(YUITEST_CMD);
        workingsetMenu.removeMenuItem(JASMINETEST_CMD);
        workingsetMenu.removeMenuItem(QUNITTEST_CMD);
        workingsetMenu.removeMenuItem(TEST262TEST_CMD);
        workingsetMenu.removeMenuItem(SCRIPT_CMD);

        var type = determineFileType(selectedEntry);

        if (type === "yui") {
            workingsetMenu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            workingsetMenu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            workingsetMenu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        } else if (type === "test262") {
            workingsetMenu.addMenuItem(TEST262TEST_CMD, "", Menus.LAST);
        } else if (type === "script") {
            workingsetMenu.addMenuItem(SCRIPT_CMD, "", Menus.LAST);
        } else {
            var promise = determineTest262FileType(selectedEntry.fullPath);
            if (promise !== undefined) {
                promise.done(function (path) {
                    if (path !== undefined) {
                        workingsetMenu.addMenuItem(TEST262TEST_CMD, "", Menus.LAST);
                    }
                });
            }
        }
    });

    AppInit.appReady(function () {
        nodeConnection.connect(true).done(function () {
            var path = ExtensionUtils.getModulePath(module, "node/ProcessDomain");
            nodeConnection.loadDomains([path], true).done(function () {
                var $nodeConnection = $(nodeConnection);
                $nodeConnection.on("process.stdout", function (event, pid, data) {
                    data = data.replace(/\n/g, '<br>');
                    if (_windows.hasOwnProperty(pid) === false) {
                        alert("ERROR: there is no window with pid=" + pid);
                    } else {
//                        console.log("stdout: " + data);
                        var _window = _windows[pid],
                            _time = _times[pid];
                        _window.document.getElementById("stdout").innerHTML += data;
                        var elapsed = new Date() - _time;
                        _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                        _window.document.getElementById("stdout-section").style.display = "block";
                    }
                });
                $nodeConnection.on("process.stderr", function (event, pid, data) {
                    data = data.replace(/\n/g, '<br>');
                    if (_windows.hasOwnProperty(pid) === false) {
                        alert("ERROR: there is no window with pid=" + pid);
                    } else {
//                        console.log("stderr: " + data);
                        var _window = _windows[pid],
                            _time = _times[pid];
                        _window.document.getElementById("stderr").innerHTML += data;
                        var elapsed = new Date() - _time;
                        _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                        _window.document.getElementById("stderr-section").style.display = "block";
                    }
                });
                $nodeConnection.on("process.exit", function (event, pid, code) {
                    if (_windows.hasOwnProperty(pid) === false) {
                        alert("ERROR: there is no window with pid=" + pid);
                    } else {
                        var _window = _windows[pid],
                            _time = _times[pid],
                            elapsed = new Date() - _time;
                        _window.document.getElementById("exitcode").innerHTML = "finished with exit code " + code;
                        _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                    }
                });
            });
        });
    });
});
