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
/*global brackets, define, $, window, Mustache, document, setInterval */
define(function (require, exports, module) {
    'use strict';
    
   /* var AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        Menus               = brackets.getModule("command/Menus"),
        NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        LanguageManager     = brackets.getModule("language/LanguageManager"),
        
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        FileViewController  = brackets.getModule("project/FileViewController"),
        ;

    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        templateEntry       = new NativeFileSystem.FileEntry(moduledir + '/templates/jasmineNodeReportTemplate.html'),
        reportJasNodeEntry  = new NativeFileSystem.FileEntry(moduledir + '/node/reports/jasmineReport.html'),
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
        commands            = [],
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
        SCRIPT_CMD          = "script_cmd",
        NODETEST_CMD        = "nodetest_cmd",
        GENERATE_JASMINE_CMD = "generate_jasmine_cmd",
        GENERATE_QUNIT_CMD  = "generate_qunit_cmd",
        GENERATE_YUI_CMD    = "generate_yui_cmd",
        VIEWHTML_CMD        = "viewhtml_cmd",
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = new NodeConnection(),
        _windows            = {},
        testFileIndex       = 0,
        enableHtml          = false,
        $selectedRow,
        _xunit_panel_visible;
     */
    var _collapsed          = false,
        jsXunitTemplate     = require("text!templates/panel.html?u=1"),
        Resizer             = brackets.getModule("utils/Resizer"),
        StatusBar           = brackets.getModule("widgets/StatusBar"),
        PanelManager        = brackets.getModule("view/PanelManager"),
        $xunitResults       = {};
        
    function toggleCollapsed(collapsed) {
        if (collapsed === undefined) {
            collapsed = !_collapsed;
        }
        
        _collapsed = collapsed;
        if (_collapsed) {
            Resizer.hide($xunitResults);
        } else {
            //if (JSLINT.errors && JSLINT.errors.length) {
            Resizer.show($xunitResults);
            //}
        }
    }
    
    function statusPassed(message) {
        StatusBar.updateIndicator("XUNIT", true, "xunit-failed", 'Failed');
        $("#XUNIT").text(message);
    }
    function statusFailed(message) {
        StatusBar.updateIndicator("XUNIT", true, "xunit-complete", 'Complete');
        $("#XUNIT").text(message);
    }
    function statusRunning(message) {
        message = message || "running";
        StatusBar.updateIndicator("XUNIT", true, "xunit-process", 'Running');
        $("#XUNIT").text(message);
    }
    function statusCoverage(message) {
        StatusBar.updateIndicator("XUNITCOVERAGE", true, "xunit-complete", 'Complete');
        $("#XUNITCOVERAGE").text(message);
    }
    
    
    function initializePanel() {
        console.log("initializePanel");
        var xunitHtml = Mustache.render(jsXunitTemplate, {});
        var xunitPanel = PanelManager.createBottomPanel("xunit.results", $(xunitHtml), 100);
        $xunitResults = $("#xunit-results");
        
        var xunitStatusHtml = $("<div id=\"xunit-status\" title=\"No xunit errors\">No tests</div>", {}),
            xunitCoverageHtml = $("<div id=\"xunit-coverage\" title=\"No coverage\">No coverage</div>", {});
        $(xunitStatusHtml).insertBefore("#jslint-status");
        $(xunitCoverageHtml).insertBefore("#jslint-status");
        StatusBar.addIndicator("XUNIT", $("#xunit-status"));
        StatusBar.addIndicator("XUNITCOVERAGE", $("#xunit-coverage"));
        StatusBar.updateIndicator("XUNIT", true, "xunit-disabled", 'Xunit');
        StatusBar.updateIndicator("XUNITCOVERAGE", true, "xunit-disabled", 'Xunit');

        //panel.show();
        
        $("#xunit-results .close").click(function () {
            toggleCollapsed(true);
        });

        $("#XUNIT, #XUNITCOVERAGE").click(function () {
            /*if (!$(this).hasClass('xunit-disabled')) {
                if (_xunit_panel_visible) {
                    //Resizer.hide($karmaResults);
                    _xunit_panel_visible = false;
                    //} else {
                    //showPanel();
                    
                }
            }*/
            toggleCollapsed();
        });
        toggleCollapsed(true);
    }
    function setReportWindow(url) {
        $xunitResults.find("#winReport").attr("src", url);
    }
    
    exports.initializePanel = initializePanel;
    exports.toggleCollapsed = toggleCollapsed;
    exports.statusPassed = statusPassed;
    exports.statusFailed = statusFailed;
    exports.statusRunning = statusRunning;
    exports.statusCoverage = statusCoverage;
    exports.setReportWindow = setReportWindow;
});
