require(["dojo/store/JsonRest",
            "dojo/store/Observable",
            "dojo/_base/Deferred",
            "dijit/Tree",
            "dijit/tree/dndSource",
            "dojox/form/BusyButton",
            "dojo/query",
            "dojo/domReady!"], function (JsonRest, Observable, Deferred, Tree, dndSource, BusyButton, query) {

                treeStore = JsonRest({
                    target: "/company/data/",
                    mayHaveChildren: function (object) {
                        // see if it has a children property
                        return "children" in object;
                    },
                    getChildren: function (object, onComplete, onError) {
                        // retrieve the full copy of the object
                        this.get(object.id).then(function (fullObject) {
                            // copy to the original object so it has the children array as well.
                            object.children = fullObject.children;
                            // now that full object, we should have an array of children
                            onComplete(fullObject.children);
                        }, function (error) {
                            // an error occurred, log it, and indicate no children
                            console.error(error);
                            onComplete([]);
                        });
                    },
                    getRoot: function (onItem, onError) {
                        // get the root object, we will do a get() and callback the result
                        this.get(-1).then(onItem, function (error) {
                            alert("Error loading Company list");
                        });
                    },
                    getLabel: function (object) {
                        // just get the name
                        if (object.id === -1) {
                            return object.NodeName;
                        }
                        else {
                            return object.NodeName + " | " + object.Earnings + "$" + (object.TotalEarnings !== 0 && object.TotalEarnings !== object.Earnings ? " | " + object.TotalEarnings + "$" : "");
                        }
                    },
                    pasteItem: function (child, oldParent, newParent, bCopy, insertIndex) {

                        // This will prevent to add a child to its parent again.
                        if (child.ParentId == newParent.id) { return false; }

                        var store = this;
                        store.get(oldParent.id).then(function (oldParent) {
                            store.get(newParent.id).then(function (newParent) {
                                store.get(child.id).then(function (child) {
                                    var oldChildren = oldParent.children;
                                    dojo.some(oldChildren, function (oldChild, i) {
                                        if (oldChild.id == child.id) {
                                            oldChildren.splice(i, 1);
                                            return true; // done
                                        }
                                    });

                                    store.put(oldParent);

                                    //This will put new child
                                    child.ParentId = newParent.id;
                                    store.put(child);

                                    newParent.children.splice(insertIndex || 0, 0, child);

                                    store.put(newParent);

                                    //Reloading the parent of recently updated company 500ms
                                    var ParentId = new Deferred();
                                    Deferred.when(ParentId, reloadNodeUpToParent);
                                    setTimeout(function () {
                                        ParentId.resolve(newParent.id);
                                        ParentId.resolve(oldParent.id);
                                    }, 500);

                                }, function (error) {
                                    alert("Error loading " + child.NodeName);
                                });
                            }, function (error) {
                                alert("Error loading " + newParent.NodeName);
                            });
                        }, function (error) {
                            alert("Error loading " + oldParent.NodeName);
                        });
                    },
                    put: function (object, options) {
                        this.onChildrenChange(object, object.children);
                        this.onChange(object);
                        return JsonRest.prototype.put.apply(this, arguments);
                    }
                });

                tree = new Tree({
                    model: treeStore,
                    dndController: dndSource
                }, "tree"); // make sure you have a target HTML element with this id

                tree.startup();

                dojo.query("body").addClass("claro");

                var addNewChildButton = new BusyButton({
                    id: "add-new-child",
                    busyLabel: "Wait a moment...",
                    label: "Add new root/child Company",
                    timeout: 500
                }, "add-new-child");

                var removeChildButton = new BusyButton({
                    id: "remove-child",
                    busyLabel: "Wait a moment...",
                    label: "Remove selected Company",
                    timeout: 500
                }, "remove-child");

                var companyEarningsButton = new BusyButton({
                    id: "company-earnings",
                    busyLabel: "Wait a moment...",
                    label: "Company Earnings",
                    timeout: 500
                }, "company-earnings");


                query("#add-new-child").on("click", function () {

                    var selectedObject = tree.get("selectedItems")[0];

                    if (!selectedObject) {
                        selectedObject = tree.rootNode.item;
                    }

                    //Sync selectedObject with server
                    var isRootCompany = selectedObject.id === -1;
                    treeStore.get(selectedObject.id).then(function (selectedObject) {
                        var name = prompt("Enter a name for a " + (isRootCompany ? "new" : "child") + " Company");
                        if (name != null && name != "") {

                            var newItem = { NodeName: name, ParentId: selectedObject.id, children: "", Earnings: 0 };

                            selectedObject.children.push(newItem);

                            treeStore.put(newItem);

                            //Loading recently added node 500ms after puting it
                            var nodeId = new Deferred();
                            Deferred.when(nodeId, reloadNode);
                            setTimeout(function () {
                                nodeId.resolve(selectedObject.id);
                            }, 500);

                        } else { return alert("Name can not be empty."); }

                    }, function (error) {
                        alert("Error loading " + selectedObject.NodeName);
                    });
                });

                query("#remove-child").on("click", function () {

                    var selectedObject = tree.get("selectedItems")[0];

                    if (!selectedObject || selectedObject.id === -1) {
                        return alert("No Company selected");
                    }

                    var answer = confirm("Are you sure you want to permanently delete this Company and all its children Companies?")
                    if (answer) {

                        treeStore.get(selectedObject.id).then(function (selectedObject) {

                            treeStore.remove(selectedObject.id);

                            //Reloading the parent of recently removed node 500ms after removing it
                            var ParentId = new Deferred();
                            Deferred.when(ParentId, reloadNode);
                            Deferred.when(ParentId, reloadNodeUpToParent);
                            setTimeout(function () {
                                ParentId.resolve(selectedObject.ParentId);
                            }, 500);

                        }, function (error) {
                            alert("Error loading " + selectedObject.NodeName);
                        });
                    }
                });

                tree.on("dblclick", function (object) {

                    treeStore.get(object.id).then(function (object) {

                        var name = prompt("Enter a new name for the Company");
                        if (name != null && name != "") {
                            object.NodeName = name;

                            treeStore.put(object).then(function () {
                            }, function (error) {
                                // On Error revert Value
                                reloadNode(object.ParentId);

                                alert("Error renaming " + object.NodeName);
                            });

                        } else { return alert("Name can not be empty."); }
                    }, function (error) {
                        alert("Error loading " + object.NodeName);
                    });
                }, true);

                query("#company-earnings").on("click", function () {


                    var selectedObject = tree.get("selectedItems")[0];

                    if (!selectedObject || selectedObject.id === -1) {
                        return alert("No Company selected");
                    }

                    var isRootCompany = selectedObject.id === -1;
                    treeStore.get(selectedObject.id).then(function (selectedObject) {
                        var earnings = prompt("Enter estimated earnings for a " + (isRootCompany ? "new" : "child") + " Company");

                        if (!isNaN(earnings)) {
                            selectedObject.Earnings = earnings;

                            treeStore.put(selectedObject).then(function () {
                            }, function (error) {
                                // On Error revert Value
                                reloadNodeUpToParent(selectedObject.ParentId);
                                alert("Error to set Company Earnings " + selectedObject.Earnings);
                            });

                            //Reloading the parent of recently updated company 500ms
                            var ParentId = new Deferred();
                            Deferred.when(ParentId, reloadNodeUpToParent);
                            setTimeout(function () {
                                ParentId.resolve(selectedObject.id);
                            }, 500);
                        }
                    }, function (error) {
                        alert("Error loading " + selectedObject.Earnings);
                    });
                });
            });

function reloadNode(id) {
    treeStore.get(id).then(function (Object) {
        treeStore.put(Object);
    })
};

function reloadNodeUpToParent(id) {
    treeStore.get(id).then(function (Object) {
        var current = Object;

        treeStore.onChange(current);
        if (current.ParentId != null && current.ParentId !== -1) {
            reloadNodeUpToParent(current.ParentId);
        }
    })
};

function removeAllChildren(node) {
    treeStore.get(node.id).then(function (node) {

        var nodeChildren = node.children;
        for (n in nodeChildren) {
            removeAllChildren(nodeChildren[n]);
        }
        treeStore.remove(node.id);
    }, function (error) {
        alert(error);
    });
};