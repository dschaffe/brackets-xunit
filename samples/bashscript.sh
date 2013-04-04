#!/bin/bash -x
# brackets-xunit:    args=1,1,1,1,1
echo "running a bash script..."
echo "args= $*"
for a in $*
do
    echo "sleep $a"
    sleep $a
done
exit 0
