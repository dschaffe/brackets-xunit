brackets-xunit
===========

A brackets extension to detect and run various test tools against the currently edited brackets program.  The plugin
currently supports jasmine, YUI3, qunit, and test262 testing frameworks.  The plugin also can run any script if it is executable
and contains #!/usr/bin/env on the first line.  For example a node, python, or bash script can be executed.  Selecting Run
Script on the context menu will invoke a new window containing the stdout and stderr of the script output.

Installation
===========

1. Find your extensions folder by going to "Help -> Show Extensions Folder"
2. Extract the .zip to your Brackets extension directory (extensions/user)
3. Start Brackets and create a unit test in brackets, see the samples directory for examples
4. Right click on the script file in the sidebar
5. Select Run Unit Test from the context menu
6. The results will appear in new window

Usage
=====

The goal is to get quick feedback when creating unit tests.  The extension detects the file is a unit test, creates an html
file configuring the correct unit test runner, and loads the report in a new brackets window.  

Implementation Notes
============

Currently supports jasmine, YUI3, qunit, and test262.  The script detects the type by looking for "brackets-xunit: <type>" where <type> is 
jasmine, yui, qunit, and test262.  If no type tag exists the extension looks for patterns to determine if the file is of a particular type.  
For example if a file contains describe() and it() functions the Run jasmine xunit test menu item appears.  

The extension also supports an annotation to include external files.  For example the samples/jasmine/PlayerSpec.js test requires SpecHelper.js,
src/Player.js, and src/Song.js to be loaded into the html wrapper file.  In a comment:
    /* brackets-xunit: includes=SpecHelper.js,src/Player.js,src/Song.js */

In the generated html the following is added into the head section based upon the comment:
    <script src="samples/jasmine/SpecHelper.js"></script>
    <script src="samples/jasmine/src/Player.js"></script>
    <script src="samples/jasmine/src/Song.js"></script>

Let me know if you have any suggestions or issues.  Contact me at: dschaffe@adobe.com.

The test262 support http://test262.ecmascript.org/ detects if a test is within the test262 directory structure and runs test262.py on the
selected test or directory.  The output is shown in a new window.  To use the test262 functionality edit config.js and setup one or more
javascript shells to use when running tests.

Limitations and Future Enhancements
============

* Should add more unit test frameworks like nodeunit and others.
* Interested in generating test templates based on parsing an existing api to help generate or start tests.

Change Log
=========

03-21-2013 Initial commit
04-01-2013 added qunit, test262, and script support
