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
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        FileViewController  = brackets.getModule("project/FileViewController");

    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        jasmineReportEntry  = new NativeFileSystem.FileEntry(moduledir + '/generated/jasmineReport.html'),
        qunitReportEntry    = new NativeFileSystem.FileEntry(moduledir + '/generated/qUnitReport.html'),
        configEntry         = new NativeFileSystem.FileEntry(moduledir + '/config.js'),
        config              = {},
        templateEntry       = new NativeFileSystem.FileEntry(moduledir + '/html/jasmineReportTemplate.html'),
        reportJasNodeEntry  = new NativeFileSystem.FileEntry(moduledir + '/node/reports/jasmineReport.html'),
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
        commands            = [],
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
        TEST262TEST_CMD     = "test262_cmd",
        SCRIPT_CMD          = "script_cmd",
        NODETEST_CMD        = "nodetest_cmd",
        GENERATE_JASMINE_CMD = "generate_jasmine_cmd",
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
        contents = DocumentManager.getCurrentDocument().getText();

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
            _windows[pid] = {window: newWindow, startTime: new Date(), type: "test262", passes: 0, fails: 0, expfails: 0, current: '', done: false };
            var doc = newWindow.document;
            var entrypoint = doc.getElementById("entrypoint");
            var shellLabel = doc.createElement("span");
            shellLabel.className = "command";
            shellLabel.innerHTML = "Shell";
            shellLabel.style.marginTop = "10px";
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
            exitcodeText.innerHTML = "running with pid " + pid;
            entrypoint.appendChild(exitcodeText);
            entrypoint.appendChild(doc.createElement("br"));
             
            var stdoutsection = doc.createElement("span");
            stdoutsection.id = "stdoutsection" + pid;
            stdoutsection.className = "section";
            stdoutsection.style.display = "block";
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
            nodeConnection.domains.process.spawnSession({executable: test262, args: params, directory: base, shells: test262shells[i], cacheTime: 3000}).done(spawned);
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
        nodeConnection.domains.process.spawnSession({executable: path, args: args, cacheTime: 100}).done(function (status) {
            var pid = status[0];
            var template = require("text!templates/process.html");
            var html = Mustache.render(template, { path: path, title: "script - " + path, args: argsout});
            var newWindow = window.open("about:blank", null, "width=600,height=200");
            newWindow.document.write(html);
            newWindow.document.getElementById("exitcode").innerHTML = "running with pid " + pid;
            newWindow.focus();
            _windows[pid] = {window: newWindow, startTime: new Date(), type: "script"};
        });
    }

    function generateJasmineTest() {
        var text = DocumentManager.getCurrentDocument().getText();
        var filename = DocumentManager.getCurrentDocument().file.name;
        var acorn = require('thirdparty/acorn/acorn_loose');
        var walk = require('thirdparty/acorn/walk');
        var ast = acorn.parse_dammit(text);
        var i, j, functions = [], fparams, fname, fparamstr;
        walk.simple(ast, {
            FunctionDeclaration: function (node) {
                fparams = [];
                for (i = 0; i < node.params.length; i++) {
                    fparams.push(node.params[i].name);
                }
                functions.push({name: node.id.name, params: fparams});
            }
        });
        var test = '// generated by xUnit ' + new Date() + '\n' +
                   '// jasmine test for ' + filename + '\n' +
                   '// brackets-xunit: includes=' + filename + '\n' +
                   '/*global describe, it */\n\n';
        for (i = 0; i < functions.length; i++) {
            fparamstr = '';
            for (j = 0; j < functions[i].params.length; j++) {
                if (j > 0) {
                    fparamstr += ", ";
                }
                fparamstr += functions[i].params[j];
            }
            test += 'describe("test function ' + functions[i].name + '(' + fparamstr + ')", function () {\n';
            if (fparamstr !== '') {
                test += '    var ' + fparamstr + ';\n';
            }
            test += '    it("call function ' + functions[i].name + '", function () {\n' +
                    '        expect(' + functions[i].name + '(' + fparamstr + ')).toEqual("");\n' +
                    '    });\n' +
                    '});\n';
        }
        var name = DocumentManager.getCurrentDocument().file.name,
            fullpath = DocumentManager.getCurrentDocument().file.fullPath,
            basedir = fullpath.substring(0, fullpath.lastIndexOf("/") + 1),
            testname = name.substring(0, name.lastIndexOf('.js')) + '.spec.js',
            newTestEntry = new NativeFileSystem.FileEntry(basedir + testname);
        FileUtils.writeText(newTestEntry, test).done(function () {
            FileViewController.openAndSelectDocument(newTestEntry.fullPath, FileViewController.PROJECT_MANAGER);
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

    // jasmine-node
    function runJasmineNode() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var path = entry.fullPath;
        nodeConnection.domains.jasmine.runTest(path)
            .fail(function (err) {
                console.log("[brackets-jasmine] error running file: " + entry.fullPath + " message: " + err.toString());
                var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Error",
                    "The test file contained an error: " + err.toString()
                );
            });
    }

    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
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

    AppInit.appReady(function () {
        nodeConnection = new NodeConnection();
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            connectionPromise.fail(function () {
                console.error("[brackets-xunit] failed to connect to node");
            });
            return connectionPromise;
        }

        function loadJasmineDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/JasmineDomain");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-xunit] failed to load jasmine domain");
            });
            return loadPromise;
        }

        $(nodeConnection).on("jasmine.update", function (evt, jsondata) {
            if (jsondata.length > 5 && jsondata.substring(0, 6) === 'Error:') {
                var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Node Error",
                    jsondata.substring(7)
                );
            } else {
                FileUtils.readAsText(templateEntry).done(function (text, timestamp) {
                    jsondata = jsondata.replace(/'/g, "");
                    var data = JSON.parse(jsondata);
                    var index = text.indexOf("%jsondata%");
                    text = text.substring(0, index) + jsondata + text.substring(index + 10);
                    index = text.indexOf("%time%");
                    var totaltime = 0;
                    var i;
                    for (i = 0; i < data.length; i++) {
                        totaltime = totaltime + parseFloat(data[i].time);
                    }
                    text = text.substring(0, index) + totaltime + text.substring(index + 6);
                    FileUtils.writeText(reportJasNodeEntry, text).done(function () {
                        window.open(reportJasNodeEntry.fullPath);
                    });
                });
            }
        });

        function loadProcessDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/ProcessDomain");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-xunit] failed to load process domain");
            });
            return loadPromise;
        }

        function processOutput(pid, data) {
            var status = '';
            if (_windows[pid].done === false) {
                if (data.indexOf("=== Summary ===") > -1) {
                    _windows[pid].done = true;
                }
                var passes = data.match(/passed/g);
                if (passes === null) {
                    passes = 0;
                } else {
                    passes = passes.length;
                }
                _windows[pid].passes += passes;
                if (passes > 0) {
                    status += '<span style="color:green">' + _windows[pid].passes + ' passes</span>, ';
                } else {
                    status += _windows[pid].passes + " passes, ";
                }
                var failures = data.match(/failed in (non-)?strict mode ===<br>/g);
                if (failures === null) {
                    failures = 0;
                } else {
                    failures = failures.length;
                }
                _windows[pid].fails += failures;
                if (_windows[pid].fails === 0) {
                    status += "0 failures";
                } else {
                    status += ' <span style="color:red">' + _windows[pid].fails + ' failures</span>';
                }
                var expectedfailures = data.match(/failed in (non-)?strict mode as expected<br>/g);
                if (expectedfailures === null) {
                    expectedfailures = 0;
                } else {
                    expectedfailures = expectedfailures.length;
                }
                _windows[pid].expfails += expectedfailures;
                if (_windows[pid].expfails > 0) {
                    status += ", " + _windows[pid].expfails + " expected failures";
                }
                _windows[pid].window.document.getElementById("status" + pid).innerHTML = status;
            }
        }
            
        $(nodeConnection).on("process.stdout", function (event, result) {
            var pid = result.pid,
                data = result.data;
            data = data.replace(/\n/g, '<br>');
            if (_windows.hasOwnProperty(pid) === false) {
                showError("Process Error", "there is no window with pid=" + pid);
            } else {
                var _window = _windows[pid].window,
                    _time = _windows[pid].startTime,
                    _type = _windows[pid].type,
                    elapsed = new Date() - _time;
                if (_windows[pid].type === 'test262') {
                    data = _windows[pid].current + data;
                    var status = '';
                    _windows[pid].current = data.substring(data.lastIndexOf("<br>") + 4);
                    if (_windows[pid.current] !== '') {
                        data = data.substring(0, data.lastIndexOf('<br>') + 4);
                    }
                    _window.document.getElementById("stdout" + pid).innerHTML += data;
                    _window.document.getElementById("stdout" + pid).scrollTop = _window.document.getElementById("stdout" + pid).scrollHeight;
                    _window.document.getElementById("time" + pid).innerHTML = formatTime(elapsed);
                    processOutput(pid, data);
                } else {
                    _window.document.getElementById("stdout-section").style.display = "block";
                    _window.document.getElementById("stdout").innerHTML += data;
                    _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                }
            }
        });
                
        $(nodeConnection).on("process.stderr", function (event, result) {
            var pid = result.pid,
                data = result.data;
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

        $(nodeConnection).on("process.exit", function (event, result) {
            var pid = result.pid,
                data = result.data;
            data = data.replace(/\n/g, '<br>');
            if (_windows.hasOwnProperty(pid) === false) {
                showError("Process Error", "there is no window with pid=" + pid);
            } else {
                var _window = _windows[pid].window,
                    _time = _windows[pid].startTime,
                    elapsed = new Date() - _time,
                    code = result.exitcode;
                if (_windows[pid].type === 'test262') {
                    var status = '';
                    _window.document.getElementById("stdout" + pid).innerHTML += data;
                    _window.document.getElementById("stdout" + pid).scrollTop = _window.document.getElementById("stdout" + pid).scrollHeight;
                    _window.document.getElementById("exitcode" + pid).innerHTML = "finished with exit code " + code;
                    _window.document.getElementById("time" + pid).innerHTML = formatTime(elapsed);
                    processOutput(pid, data);
                } else {
                    _window.document.getElementById("stdout-section").style.display = "block";
                    _window.document.getElementById("stdout").innerHTML += data;
                    _window.document.getElementById("exitcode").innerHTML = "finished with exit code " + code;
                    _window.document.getElementById("time").innerHTML = formatTime(elapsed);
                }
            }
        });
        chain(connect, loadJasmineDomain, loadProcessDomain);
    });
    
    // determine if a file is a known test type
    // first look for brackets-xunit: [type], takes precedence
    // next look for distinguishing clues in the file:
    //   YUI: 'YUI(' and 'Test.runner.test'
    //   jasmine: 'describe' and 'it'
    //   QUnit: 'test()' and 'it()'
    //   test262: look at path for test directory then check for 
    //           ../tools/packaging/test262.py
    function determineFileType(fileEntry, text) {
        if (fileEntry) {
            if (text.match(/brackets-xunit:\s*yui/i) !== null) {
                return "yui";
            } else if (text.match(/node: true/i) && text.match(/describe\s*\(/)) {
                return "node";
            } else if (text.match(/brackets-xunit:\s*jasmine-node/i)) {
                return "node";
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
            } else if (fileEntry.fullPath.match(/\.js$/)) {
                return "generate";
            }
        }
        return "unknown";
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
        } else if (type === "node") {
            menu.addMenuItem(NODETEST_CMD, "", Menus.LAST);
        } else if (type === "generate") {
            menu.addMenuItem(GENERATE_JASMINE_CMD, "", Menus.LAST);
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
    commands = [ YUITEST_CMD, JASMINETEST_CMD, QUNITTEST_CMD, SCRIPT_CMD, NODETEST_CMD, GENERATE_JASMINE_CMD ];
    CommandManager.register("Run YUI Unit Test", YUITEST_CMD, runYUI);
    CommandManager.register("Run Jasmine xUnit Test", JASMINETEST_CMD, runJasmine);
    CommandManager.register("Run QUnit xUnit Test", QUNITTEST_CMD, runQUnit);
    CommandManager.register("Run Script", SCRIPT_CMD, runScript);
    CommandManager.register("Run Jasmine-Node xUnit Test", NODETEST_CMD, runJasmineNode);
    CommandManager.register("Generate Jasmine Test", GENERATE_JASMINE_CMD, generateJasmineTest);

    FileUtils.readAsText(configEntry)
        .done(function (text, readTimestamp) {
            try {
                config = JSON.parse(text);
                if (config.hasOwnProperty("commands") && config.commands[0].name !== '<description>') {
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
    // Determine type of test for selected item in project
    $(workingsetMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = DocumentManager.getCurrentDocument().file,
            text = DocumentManager.getCurrentDocument().getText();
        checkFileTypes(workingsetMenu, selectedEntry, text);
    });
});