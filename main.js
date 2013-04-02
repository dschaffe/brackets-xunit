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
/*global brackets, define, $, window, Mustache */

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
		templateEntry       = new NativeFileSystem.FileEntry(moduledir + '/html/jasmineReportTemplate.html'),
        reportJasNodeEntry  = new NativeFileSystem.FileEntry(moduledir + '/node/reports/jasmineReport.html'),
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
		NODETEST_CMD     = "nodetest_cmd",
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = null;

    
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
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument();
        }
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


// jasmine-node

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

    AppInit.appReady(function () {
        nodeConnection = new NodeConnection();
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            connectionPromise.fail(function () {
                console.error("[brackets-jasmine] failed to connect to node");
            });
            return connectionPromise;
        }

        function loadJasmineDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/JasmineDomain");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-jasmine] failed to load jasmine domain");
            });
            return loadPromise;
        }

        $(nodeConnection).on("jasmine.update", function (evt, jsondata) {
            if (jsondata.length > 5 && jsondata.substring(0, 6) === 'Error:') {
                var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Error",
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

        chain(connect, loadJasmineDomain);
    });
    
	function runJasmineNode() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === null) {
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
	
    // determine if a file is a known test type
    // first look for brackets-xunit: [type], takes precedence
    // next look for distinguishing clues in the file:
    //   YUI: 'YUI(' and 'Test.runner.test'
    //   jasmine: 'describe' and 'it'
    //   QUnit: 'test()' and 'it()'
	//	 node: look for the jslint option called node and is set to true
	//   /*jslint node:true */  See http://www.jslint.com/lint.html#options
    // todo: unit test this function
    function determineFileType(fileEntry) {
	
        if (fileEntry) {
            var text = DocumentManager.getCurrentDocument().getText();
            if (text.match(/brackets-xunit:\s*yui/i) !== null) {
                return "yui";
            } else if (text.match(/brackets-xunit:\s*jasmine/i) !== null) {
                return "jasmine";
            } else if (text.match(/node: true/i) && text.match(/describe\s*\(/)) {
                return "node";
            } else if (text.match(/brackets-xunit:\s*qunit/i) !== null) {
                return "qunit";
            } else if (text.match(/YUI\s*\(/) && text.match(/Test\.Runner\.run\s*\(/)) {
                return "yui";
            } else if (text.match(/describe\s*\(/) && text.match(/it\s*\(/)) {
                return "jasmine";
            } else if (text.match(/test\s*\(/) && text.match(/ok\s*\(/)) {
                return "qunit";
            } 
        }
        return "unknown";
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
	
	CommandManager.register("Run Jasmine-Node xUnit Test", NODETEST_CMD, function () {
        runJasmineNode();
    });
    
    // Determine type of test for selected item in project
    $(projectMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = ProjectManager.getSelectedItem();
        projectMenu.removeMenuItem(YUITEST_CMD);
        projectMenu.removeMenuItem(JASMINETEST_CMD);
        projectMenu.removeMenuItem(QUNITTEST_CMD);
		projectMenu.removeMenuItem(NODETEST_CMD);
        
        var type = determineFileType(selectedEntry);
        
        if (type === "yui") {
            projectMenu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            projectMenu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            projectMenu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        } else if (type === "node") {
            projectMenu.addMenuItem(NODETEST_CMD, "", Menus.LAST);
        }
    });
    
    // Determine type of test for selected item in working set
    $(workingsetMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = DocumentManager.getCurrentDocument().file;
        workingsetMenu.removeMenuItem(YUITEST_CMD);
        workingsetMenu.removeMenuItem(JASMINETEST_CMD);
        workingsetMenu.removeMenuItem(QUNITTEST_CMD);
		workingsetMenu.removeMenuItem(NODETEST_CMD);
        
        var type = determineFileType(selectedEntry);
        
        if (type === "yui") {
            workingsetMenu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            workingsetMenu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            workingsetMenu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        } else if (type === "node") {
            workingsetMenu.addMenuItem(NODETEST_CMD, "", Menus.LAST);
        }
    });

});
