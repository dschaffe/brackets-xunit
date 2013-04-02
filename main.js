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
        configEntry         = new NativeFileSystem.FileEntry(moduledir + '/config.js'),
        config              = {},
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
        commands            = [],
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
        TEST262TEST_CMD     = "test262_cmd",
        SCRIPT_CMD          = "script_cmd",
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = new NodeConnection(),
        test262shells       = [],
        _windows            = {};

    // display a modal dialog when an error occurs
    function showError(title, message) {
        Dialogs.showModalDialog(
            Dialogs.DIALOG_ID_ERROR,
            title,
            message
        );
    }
    
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
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1),
            contents = '',
            includes = '';
        if (entry === DocumentManager.getCurrentDocument().file) {
            contents = DocumentManager.getCurrentDocument().getText();
        }

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
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument();
        }
        var f = entry.fullPath;
        var fname = DocumentManager.getCurrentDocument().filename;
        var data = { filename : entry.name,
                     title : 'QUnit test - ' + entry.name,
                     templatedir : moduledir,
                     contents : DocumentManager.getCurrentDocument().getText()
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
        var path = entry.fullPath,
            base = path.substring(0, path.lastIndexOf('/test/')),
            test262 = base + "/tools/packaging/test262.py",
            test = '';
        if (path.indexOf("/suite/") > -1) {
            test = path.substring(path.indexOf("/suite/") + 7);
        }
        var teststr = test,
            i,
            shell,
            params;
        if (test === '') {
            teststr = 'all';
        }
        var template = require("text!templates/test262.html");
        var html = Mustache.render(template, { tests: teststr,
                                               title: "test262 - test/suite/" + test});
        var newWindow = window.open("about:blank", null, "width=600,height=200");
        newWindow.document.write(html);
        var spawned = function (data) {
            var pid = data[0],
                shell = data[2].name + " : " + data[2].path;
            _windows[pid] = {window: newWindow, startTime: new Date(), type: "test262", output: "", index: i };
            var doc = newWindow.document;
            var entrypoint = doc.getElementById("entrypoint");
            var shellLabel = doc.createElement("span");
            shellLabel.className = "command";
            shellLabel.innerHTML = "Shell";
            shellLabel.style.marginTop = "20px";
            entrypoint.appendChild(shellLabel);
            
            var shellText = doc.createElement("span");
            shellText.className = "details";
            shellText.innerHTML = shell;
            entrypoint.appendChild(shellText);
            entrypoint.appendChild(doc.createElement("br"));

            var statusLabel = doc.createElement("span");
            statusLabel.className = "command";
            statusLabel.innerHTML = "Status";
            entrypoint.appendChild(statusLabel);
            
            var statusText = doc.createElement("span");
            statusText.className = "details";
            statusText.id = "status" + pid;
            statusText.innerHTML = "0 passes, 0 failures";
            entrypoint.appendChild(statusText);
            entrypoint.appendChild(doc.createElement("br"));
            
            var timeLabel = doc.createElement("span");
            timeLabel.className = "command";
            timeLabel.innerHTML = "Time";
            entrypoint.appendChild(timeLabel);
            
            var timeText = doc.createElement("span");
            timeText.className = "details";
            timeText.id = "time" + pid;
            timeText.innerHTML = "0s";
            entrypoint.appendChild(timeText);
            entrypoint.appendChild(doc.createElement("br"));

            var exitcodeLabel = doc.createElement("span");
            exitcodeLabel.className = "command";
            exitcodeLabel.innerHTML = "Exit code";
            entrypoint.appendChild(exitcodeLabel);
            
            var exitcodeText = doc.createElement("span");
            exitcodeText.className = "details";
            exitcodeText.id = "exitcode" + pid;
            exitcodeText.innerHTML = "running with pid " + pid + "<br>";
            entrypoint.appendChild(exitcodeText);
            entrypoint.appendChild(doc.createElement("br"));
             
            var stdoutsection = doc.createElement("span");
            stdoutsection.id = "stdoutsection" + pid;
            stdoutsection.className = "section";
            var stdoutlabel = doc.createElement("span");
            stdoutlabel.className = "command";
            stdoutlabel.appendChild(doc.createTextNode("output"));
            var stdout = doc.createElement("div");
            stdout.className = "content";
            stdout.id = "stdout" + pid;
            var out = "$ ";
            for (i = 0; i < data[1].length; i++) {
                out += data[1][i] + " ";
            }
            out += '<br>';
            stdout.innerHTML = out;
            stdoutsection.appendChild(stdoutlabel);
            stdoutsection.appendChild(stdout);
            entrypoint.appendChild(stdoutsection);
            
            var stderrsection = doc.createElement("span");
            stderrsection.id = "stderrsection" + pid;
            stderrsection.className = "section";
            var stderrlabel = doc.createElement("span");
            stderrlabel.className = "command";
            stderrlabel.appendChild(doc.createTextNode("error"));
            var stderr = doc.createElement("div");
            stderr.className = "content";
            stderr.id = "stderr" + pid;
            stderrsection.appendChild(stderrlabel);
            stderrsection.appendChild(stderr);
            entrypoint.appendChild(stderrsection);
        };
        for (i = 0; i < test262shells.length; i++) {
            params = ["--full-summary", "--command", test262shells[i].path, test];
            nodeConnection.domains.process.spawnSession(test262, params, base, test262shells[i]).done(spawned);
        }
        newWindow.focus();
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
            argsmatch = text.match(/brackets-xunit:\s*args=\S+/),
            argsstr = '',
            argsout = '';
            
        if (argsmatch !== null && argsmatch.length > 0) {
            argsstr = argsmatch[0].substring(argsmatch[0].indexOf("=") + 1);
            args = argsstr.split(',');
            argsout = '';
            var i;
            for (i = 0; i < args.length; i++) {
                argsout = argsout + args[i] + " ";
            }
        }
        nodeConnection.domains.process.spawnSession(path, args, {}).done(function (pid) {
            var template = require("text!templates/process.html");
            var html = Mustache.render(template, { path: path, title: "script - " + path, args: argsout});
            var newWindow = window.open("about:blank", null, "width=600,height=200");
            newWindow.document.write(html);
            newWindow.document.getElementById("exitcode").innerHTML = "running with pid " + pid;
            newWindow.focus();
            _windows[pid] = {window: newWindow, startTime: new Date(), type: "script"};
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
        if (path.substring(path.length - 5) === '/test') {
            path += "/";
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
    function determineFileType(fileEntry, text) {
        if (fileEntry) {
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
        result = result + Math.round(10 * secs) / 10 + "s";
        return result;
    }

    // on click click check if file matches a test type and add context menuitem
    function checkFileTypes(menu, entry, text) {
        var i;
        for (i = 0; i < commands.length; i++) {
            menu.removeMenuItem(commands[i]);
        }
        var type = determineFileType(entry, text);
        if (type === "yui") {
            menu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            menu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            menu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        } else if (type === "script") {
            menu.addMenuItem(SCRIPT_CMD, "", Menus.LAST);
        } else if (commands.indexOf("test262_cmd") > -1) {
            if (type === "test262") {
                menu.addMenuItem(TEST262TEST_CMD, "", Menus.LAST);
            } else {
                var promise = determineTest262FileType(entry.fullPath);
                if (promise !== undefined) {
                    promise.done(function (path) {
                        if (path !== undefined) {
                            menu.addMenuItem(TEST262TEST_CMD, "", Menus.LAST);
                        }
                    });
                }
            }
        }
    }

    // Register commands as right click menu items
    commands = [ YUITEST_CMD, JASMINETEST_CMD, QUNITTEST_CMD, SCRIPT_CMD ];
    CommandManager.register("Run YUI Unit Test", YUITEST_CMD, function () {
        runYUI();
    });
    CommandManager.register("Run Jasmine xUnit Test", JASMINETEST_CMD, function () {
        runJasmine();
    });
    CommandManager.register("Run QUnit xUnit Test", QUNITTEST_CMD, function () {
        runQUnit();
    });
    CommandManager.register("Run Script", SCRIPT_CMD, function () {
        runScript();
    });
    FileUtils.readAsText(configEntry)
        .done(function (text, readTimestamp) {
            try {
                config = JSON.parse(text);
                if (config.hasOwnProperty("commands") && config.command !== '<path to js shell>') {
                    commands.push(TEST262TEST_CMD);
                    test262shells = config.commands;
                    CommandManager.register("Run test262 xUnit Test", TEST262TEST_CMD, function () {
                        runTest262();
                    });
                } else {
                    console.log("[brackets-xunit]: " + moduledir + "/config.js commands property is not set");
                }
            } catch (e) {
                console.log("[brackets-xunit]: " + moduledir + "/config.js could not parse config info");
            }
        })
        .fail(function (error) {
            console.log("[brackets-xunit]: could not load file " + moduledir + "/config.js");
        });

    // Determine type of test for selected item in project
    $(projectMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = ProjectManager.getSelectedItem(),
            text = '';
        if (selectedEntry.fullPath === DocumentManager.getCurrentDocument().file.fullPath) {
            text = DocumentManager.getCurrentDocument().getText();
        }
        checkFileTypes(projectMenu, selectedEntry, text);
    });

    // Determine type of test for selected item in working set
    $(workingsetMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = DocumentManager.getCurrentDocument().file,
            text = DocumentManager.getCurrentDocument().getText();
        checkFileTypes(workingsetMenu, selectedEntry, text);
    });

    AppInit.appReady(function () {
        nodeConnection.connect(true).done(function () {
            var path = ExtensionUtils.getModulePath(module, "node/ProcessDomain");
            nodeConnection.loadDomains([path], true).done(function () {
                var $nodeConnection = $(nodeConnection);
                $nodeConnection.on("process.stdout", function (event, pid, data) {
                    data = data.replace(/\n/g, '<br>');
                    if (_windows.hasOwnProperty(pid) === false) {
                        showError("Process Error", "there is no window with pid=" + pid);
                    } else {
                        var _window = _windows[pid].window,
                            _time = _windows[pid].startTime,
                            _type = _windows[pid].type,
                            elapsed = new Date() - _time;
                        if (_windows[pid].type === 'test262') {
                            _window.document.getElementById("stdoutsection" + pid).style.display = "block";
                            _window.document.getElementById("stdout" + pid).innerHTML += data;
                            _window.document.getElementById("stdout" + pid).scrollTop = _window.document.getElementById("stdout" + pid).scrollHeight;
                            _window.document.getElementById("time" + pid).innerHTML = formatTime(elapsed);
                            _windows[pid].output += data;
                            var currentoutput = _windows[pid].output;
                            if (currentoutput.indexOf("=== Summary ===") > -1) {
                                currentoutput = currentoutput.substring(0, currentoutput.indexOf("=== Summary ==="));
                            }
                            var passes = currentoutput.match(/passed/g);
                            if (passes === null) {
                                passes = 0;
                            } else {
                                passes = passes.length;
                            }
                            var status = passes + " passes, ";
                            var expectedfailures = currentoutput.match(/failed in (non-)?strict mode as expected<br>/g);
                            var failures = currentoutput.match(/failed in (non-)?strict mode ===<br>/g);
                            if (failures === null) {
                                status += "0 failures";
                            } else {
                                status += ' <span style="color:red">' + failures.length + ' failures</span>';
                            }
                            if (expectedfailures !== null) {
                                status += ", " + expectedfailures.length + " expected failures";
                            }
                            _window.document.getElementById("status" + pid).innerHTML = status;
                        } else {
                            _window.document.getElementById("stdout-section").style.display = "block";
                            _window.document.getElementById("stdout").innerHTML += data;
                            _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                        }
                    }
                });
                $nodeConnection.on("process.stderr", function (event, pid, data) {
                    data = data.replace(/\n/g, '<br>');
                    if (_windows.hasOwnProperty(pid) === false) {
                        showError("Process Error", "there is no window with pid=" + pid);
                    } else {
                        var _window = _windows[pid].window,
                            _time = _windows[pid].startTime,
                            _type = _windows[pid].type,
                            elapsed = new Date() - _time;
                        if (_windows[pid].type === 'test262') {
                            _window.document.getElementById("stderrsection" + pid).style.display = "block";
                            _window.document.getElementById("stderr" + pid).innerHTML += data;
                            _window.document.getElementById("time" + pid).innerHTML = formatTime(elapsed);
                            _windows[pid].error += data;
                        } else {
                            _window.document.getElementById("stderr-section").style.display = "block";
                            _window.document.getElementById("stderr").innerHTML += data;
                            _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                        }
                    }
                });
                $nodeConnection.on("process.exit", function (event, pid, code) {
                    if (_windows.hasOwnProperty(pid) === false) {
                        showError("Process Error", "there is no window with pid=" + pid);
                    } else {
                        var _window = _windows[pid].window,
                            _time = _windows[pid].startTime,
                            elapsed = new Date() - _time;
                        if (_windows[pid].type === 'test262') {
                            _window.document.getElementById("exitcode" + pid).innerHTML = "finished with exit code " + code;
                            _window.document.getElementById("time" + pid).innerHTML = formatTime(elapsed);
                        } else {
                            _window.document.getElementById("exitcode").innerHTML = "finished with exit code " + code;
                            _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                        }
                    }
                });
            });
        });
    });
});
