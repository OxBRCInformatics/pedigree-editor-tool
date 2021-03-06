var PhenoTips = (function (b) {
	var a = b.widgets = b.widgets || {};
	a.PushPatientWidget = Class.create({initialize: function () {
		this._consentsModule = null;
		this._pushManyPatients = false;
		var f = $$("div[id^=push-patient]");
		if (f.length == 0) {
			f = $$("a[id^=pushall-server]");
			if (f.length == 0) {
				return
			}
			this._pushManyPatients = true
		}
		this._serviceURL = new XWiki.Document("PushPatientService", "PhenoTips").getURL("get", "outputSyntax=plain");
		this._patientId = XWiki.currentDocument.page;
		this._initUI();
		var i = this;
		this._observeSave = function () {
			i._launchUI()
		};
		for (var e = 0; e < f.length; e++) {
			var c = f[e];
			var d = this._pushManyPatients ? c : c.down("a");
			if (!d) {
				continue
			}
			var h = c.readAttribute("name");
			var g = function (j) {
				return function (k) {
					k.stop();
					k.findElement().blur();
					i._selectedServer = j;
					if (k.findElement(".editbody")) {
						document.fire("xwiki:actions:save", {"continue": true, form: k.findElement("form")});
						document.observe("xwiki:document:saved", i._observeSave)
					} else {
						i._launchUI()
					}
				}
			};
			d.observe("click", g(h))
		}
	}, _initUI: function () {
		var f = function (j, i, h) {
			return new Element("div", {id: j, "class": "section"}).insert(i && new Element("h2").update(i) || "").insert(h && new Element("p", {"class": "intro xHint"}).update(h) || "").insert(new Element("div", {"class": "section-contents"}))
		};
		var c = this._pushManyPatients ? "Where to send all the patient data to?" : "Where to send this patient profile?";
		var d = this._pushManyPatients ? "Remote PhenoTips server where all the data will be sent." : "Remote PhenoTips server where this patient's data will be sent.";
		this._container = new Element("form", {id: "push-patients-ui", "class": "xform", method: "post", action: this._serviceURL});
		this._container.insert(f("server-selection", c, d)).insert(f("user-selection", "Authentication on remote server", "Please choose the user name to be used to authenticate on the server and send the data; this user will be marked as the reporter on the remote server.")).insert(f("group-selection", "Remote PhenoTips group", "The PhenoTips group you would like to share this patient with on the remote server. If a group is selected, the group would be the owner and the given remote user will be a collaborator. If no group is selected, the remote user will be the only owner."));
		this._container.insert(f("consents-section", "Consents", "Remote servers may accept some patient data only if the patient has consented to collection and/or sharing of such data. The set of required consents depends on the server you want to push data to."));
		this._retryButtonClass = "button secondary push-retry-button";
		this._checkBoxApprove = new Element("input", {type: "checkbox", id: "approve-checkbox", value: "approve"});
		this._approveMessage = new Element("span", {"class": "field-no-user-select"});
		var e = new Element("label", {id: "approve-label"}).update(this._checkBoxApprove).insert(this._approveMessage);
		this._approveElement = new Element("div", {"class": "confirm-push plainmessage"});
		this._approveElement.insert(e);
		this._container.insert(this._approveElement);
		this._serverManager = this._container.down("#server-selection .section-contents");
		this._userManager = this._container.down("#user-selection .section-contents");
		this._groupManager = this._container.down("#group-selection .section-contents");
		this._consentsSection = this._container.down("#consents-section");
		this._consentsManager = this._consentsSection.down(".section-contents");
		this._consentsSection.hide();
		this._consentsManager.insert('<div class="box warningmessage hidden error">Consents that need to be granted before pushing could not be found. This might prevent you from pushing this patient to a remote server</div>');
		this._initServerSelector();
		this._initMainFormActions();
		var g = this._pushManyPatients ? "Pushing patient data to a remote PhenoTips instance..." : "Pushing __patientID__ to a remote database...".replace("__patientID__", this._patientId);
		this._dialog = new b.widgets.ModalPopup(this._container, false, {title: g, verticalPosition: "top", removeOnClose: false})
	}, _updateConsentHint: function (d) {
		var c = $("consents-section").down(".intro");
		if (c) {
			c.update(d)
		}
	}, _generateServerFirstMessage: function () {
		return new Element("div", {"class": "warningmessage"}).update("Please select server first")
	}, _generateServerAndUserFirstMessage: function () {
		return new Element("div", {"class": "warningmessage"}).update("Please login to the remote server first")
	}, _generateNoServerListMessage: function () {
		var c = new Element("input", {type: "button", name: "retry", value: "Retry", "class": this._retryButtonClass}).wrap("span", {"class": "buttonwrapper"});
		var d = this;
		c.observe("click", function (e) {
			d._launchUI()
		});
		return new Element("div", {"class": "errormessage"}).update("Cannot access the list of remote servers. Please contact your administrator for further details.").insert(c)
	}, _generateCantConnectToServerMessage: function (d, g, e) {
		var c = new Element("input", {type: "button", name: "retry", value: "Retry", "class": this._retryButtonClass}).wrap("span", {"class": "buttonwrapper"});
		var f = this;
		c.observe("click", function (h) {
			f._loginAndGetConfig(g, e)
		});
		return new Element("div", {"class": "errormessage"}).update(d + " ").insert(c)
	}, _generateNoPushServerConfiguredMessage: function () {
		return new Element("div", {"class": "errormessage"}).update("Unable to authenticate user: incorrect credentials")
	}, _generateIncorrectCredentialsMessage: function () {
		return new Element("div", {"class": "errormessage"}).update("Unable to authenticate user: incorrect credentials")
	}, _generateFailedToPushPatient: function (e, d, h) {
		var c = new Element("div", {"class": "errormessage"}).update(e);
		if (d) {
			var d = new Element("input", {type: "button", name: "retry", value: "Retry", "class": this._retryButtonClass}).wrap("span", {"class": "buttonwrapper"});
			var g = this;
			d.observe("click", function (i) {
				g._pushPatient()
			});
			c.insert(d)
		}
		if (h) {
			var f = new Element("input", {type: "button", name: "retry", value: "Push as a new patient", "class": this._retryButtonClass}).wrap("span", {"class": "buttonwrapper"});
			var g = this;
			f.observe("click", function (i) {
				g._selectPushNewPatient();
				g._pushPatient()
			});
			c.insert(f)
		}
		return c
	}, _onUnapprovedUser: function () {
		this._patientData = undefined;
		this._groupManager.update(this._generateServerAndUserFirstMessage());
		this._consentsSection.hide();
		this._pushButton.disable();
		this._approveElement.hide();
		this._pushResultSection.update("");
		this._patientFieldList = undefined;
		this._userGroupsList = undefined
	}, _onNoServerSelected: function () {
		this._lastApprovedUser = undefined;
		this._lastSelectedGroup = undefined;
		this._userLoginError = undefined;
		this._serverInfo.hide();
		this._userManager.update(this._generateServerFirstMessage());
		this._onUnapprovedUser()
	}, _disableControl: function (c) {
		c.disable();
		c.__wasDisabledState = true
	}, _disableInputs: function (e) {
		this._container.addClassName("loading-indicator-large");
		var d = this._container.getElementsByTagName("input");
		for (var c = 0; c < d.length; c++) {
			if (d[c].disabled) {
				d[c].__wasDisabledState = true
			} else {
				d[c].disable()
			}
		}
		this._serverSelector.down("select").disable();
		if (!e) {
			this._cancelButton.enable()
		}
	}, _restoreInputs: function () {
		this._container.removeClassName("loading-indicator-large");
		var d = this._container.getElementsByTagName("input");
		for (var c = 0; c < d.length; c++) {
			if (d[c].__wasDisabledState) {
				delete (d[c].__wasDisabledState)
			} else {
				d[c].enable()
			}
		}
		this._serverSelector.down("select").enable()
	}, _launchUI: function () {
		var c = this;
		document.stopObserving("xwiki:document:saved", c._observeSave);
		if (this.__launchUIAjaxInProgress) {
			return
		}
		this._consentsModule = b.widgets.ConsentsModule.createNew();
		this._remoteServers = {};
		this._numAvailableServers = 0;
		this._onNoServerSelected();
		this._serverLoadMessages.update(new Element("div", {"class": "infomessage"}).update("Retrieving server list..."));
		this._serverLoadMessages.show();
		this._serverSelector.hide();
		this._container.addClassName("loading-indicator-large");
		new Ajax.Request(this._serviceURL, {method: c._container.method, parameters: {"do": "getremotes", patientId: c._patientId}, onCreate: function () {
			c.__launchUIAjaxInProgress = true;
			c._dialog.showDialog();
			c._container.up(".msdialog-modal-container").style.zIndex = 3001
		}, onSuccess: function (d) {
			console.log("PUSH: Got response for the getremotes request");
			var e = d.responseJSON;
			if (!e || e.length == 0) {
				c._serverLoadMessages.update(c._generateNoPushServerConfiguredMessage())
			} else {
				c._serverLoadMessages.hide();
				c._populateServerList(e)
			}
		}, onFailure: function (d) {
			c._serverLoadMessages.update(c._generateNoServerListMessage())
		}, on0: function (d) {
			d.request.options.onFailure(d)
		}, onComplete: function () {
			c.__launchUIAjaxInProgress = false;
			c._container.removeClassName("loading-indicator-large");
			console.log("PUSH: getting remotes - complete")
		}})
	}, _queryStoredUserName: function () {
		var c = this;
		this._userManager.update("");
		new Ajax.Request(this._serviceURL, {method: c._container.method, parameters: {"do": "getuser", serverid: this._selectedServer}, onCreate: function () {
			console.log("PUSH: get username - start");
			c._disableInputs()
		}, onSuccess: function (d) {
			if (d.responseJSON.remoteUserName) {
				c._lastApprovedUser = d.responseJSON.remoteUserName
			}
		}, onFailure: function (d) {
			console.log("PUSH: couldn't not get the user last used for this server")
		}, on0: function (d) {
			d.request.options.onFailure(d)
		}, onComplete: function () {
			c._restoreInputs();
			console.log("PUSH: getting username - complete");
			if (c._lastApprovedUser) {
				c._loginAndGetConfig(c._lastApprovedUser, null)
			} else {
				c._updateUserList()
			}
		}})
	}, _loginAndGetConfig: function (f, c) {
		console.log("loginAndGetConfig: probing " + f);
		var e = this;
		var d = {"do": "getremoteconfig", serverid: this._selectedServer, savetoken: true};
		if (c) {
			d.usr = f;
			d.pwd = c
		}
		new Ajax.Request(this._serviceURL, {method: e._container.method, parameters: d, onCreate: function () {
			console.log("PUSH: get remote config - start");
			e._disableInputs()
		}, onSuccess: function (g) {
			if (g.hasOwnProperty("responseJSON") && g.responseJSON) {
				console.log("PUSH: Got response from server: " + stringifyObject(g.responseJSON));
				e._lastLoginResponse = g.responseJSON
			} else {
				console.log("PUSH: No response from local service");
				e._lastLoginResponse = {status: "error", nolocalresponse: true}
			}
		}, onFailure: function (g) {
			console.log("PUSH: unable to get a response from remote server");
			e._lastLoginResponse = {status: "error", serverconnectproblem: true}
		}, on0: function (g) {
			g.request.options.onFailure(g)
		}, onComplete: function () {
			this._restoreInputs();
			console.log("PUSH: get remote config - complete");
			if (this._lastLoginResponse.status == "success") {
				console.log("--> login successful!");
				this._lastApprovedUser = f;
				this._updateUserList();
				this._populateGroupsAndData(this._lastLoginResponse.groups, this._lastLoginResponse.serverfields, this._lastLoginResponse.updatesEnabled);
				this._populateConsentsList(this._lastLoginResponse.consents)
			} else {
				console.log("--> login failed!");
				if (this._lastApprovedUser == f) {
					this._lastApprovedUser = undefined
				}
				this._updateUserList(f, this._lastLoginResponse, f, c)
			}
		}.bind(this)})
	}, _logoutUser: function () {
		var d = this;
		var c = {"do": "removetokens", serverid: this._selectedServer};
		new Ajax.Request(this._serviceURL, {method: d._container.method, parameters: c, onCreate: function () {
			console.log("PUSH: logout user");
			try {
				d._disableInputs()
			} catch (f) {
				console.log("ERROR: " + f)
			}
		}, onSuccess: function (e) {
			d._lastLoginResponse = undefined;
			d._lastApprovedUser = undefined;
			d._updateUserList()
		}, onFailure: function (e) {
			alert("Failed to log out")
		}, on0: function (e) {
			e.request.options.onFailure(e)
		}, onComplete: function () {
			this._restoreInputs();
			console.log("PUSH: logout - complete")
		}.bind(this)})
	}, _updateUserList: function (d, f, c, p) {
		if (f) {
			if (this._lastLoginResponse.nolocalresponse) {
				this._userManager.update(this._generateCantConnectToServerMessage("Can't connect to local service. Make sure you are currently logged in.", c, p));
				return
			}
			if (this._lastLoginResponse.unauthorizedserver) {
				this._userManager.update(this._generateCantConnectToServerMessage("This server is not authorized to push patients to the selected server. Please contact your administrator", c, p));
				return
			}
			if (this._lastLoginResponse.serverconnectproblem) {
				this._userManager.update(this._generateCantConnectToServerMessage("Cannot connect to selected PhenoTips server.", c, p));
				return
			}
			if (this._lastLoginResponse.serverdoesnotsupportclientprotocol) {
				this._userManager.update(this._generateCantConnectToServerMessage("Cannot connect to selected PhenoTips server - the server does not support the (old) version of PhenoTips this instance is running.", c, p));
				return
			}
			if (this._lastLoginResponse.clientdoesnotsupportserverprotocol) {
				this._userManager.update(this._generateCantConnectToServerMessage("Cannot connect to selected PhenoTips server - the server is running an outdated unsupported version of PhenoTips software.", c, p));
				return
			}
		}
		console.log("updateUserList: " + d + ", last approved: " + this._lastApprovedUser);
		var h = this;
		var e = new Element("table", {id: "user-list"});
		var n = function (v, r, u, q, w) {
			var x = new Element("tr");
			var s = new Element("input", {type: "radio", value: u, name: "select-user"});
			if (v) {
				s.checked = true
			}
			var t = new Element("label").insert(s).insert(u);
			x.insert(new Element("span", {"class": "fa fa-" + r}).wrap("td")).insert(t.wrap("td"));
			if (w) {
				x.insert(w.wrap("td", {"class": "controlled-element"}))
			}
			s.observe("change", function (B) {
				var z = B.findElement("input");
				var y = z.up("table").getElementsByTagName("input");
				for (var A = 0; A < y.length; A++) {
					if (y[A].getAttribute("name") != "select-user") {
						y[A].disable()
					}
				}
				var y = z.up("tr").getElementsByTagName("input");
				for (var A = 0; A < y.length; A++) {
					y[A].enable()
				}
				q()
			});
			return x
		};
		var j = false;
		if (this._lastApprovedUser) {
			j = !d || (this._lastApprovedUser == d);
			var m = new Element("input", {type: "button", name: "logout", value: "Log out", "class": "button secondary"}).wrap("span", {"class": "buttonwrapper"});
			m.observe("click", function (q) {
				this._onUnapprovedUser();
				this._logoutUser()
			}.bind(this));
			var k = n(j, "check", "Currently authenticated user: __lastApprovedUser__".replace("__lastApprovedUser__", "<strong>" + this._lastApprovedUser + "</strong> &nbsp;"), function () {
				this._userLoginError.hide();
				this._onUnapprovedUser();
				this._loginAndGetConfig(this._lastApprovedUser)
			}.bind(this), m);
			e.insert(k)
		}
		var i = new Element("span", {"class": "user-password-box"});
		var g = new Element("input", {type: "text", id: "newusername", value: "", placeholder: "user name", size: 12});
		if (d) {
			g.value = d
		}
		var l = new Element("input", {type: "password", id: "password", value: "", placeholder: "password", size: 12});
		var o = new Element("input", {type: "button", id: "authorizenewuser", name: "authorize", value: "Log in", "class": "button secondary"});
		o.observe("click", function (q) {
			if (l.value != "") {
				this._userLoginError.hide();
				this._loginAndGetConfig(g.value, l.value)
			} else {
				this._userLoginError.update("No password provided");
				this._userLoginError.show()
			}
		}.bind(this));
		if (j) {
			g.disable();
			l.disable();
			o.disable()
		}
		i.insert(g.wrap("label", {"class": "fa fa-user"})).insert(" ").insert(l.wrap("label", {"class": "fa fa-key"})).insert(" ").insert(o.wrap("span", {"class": "buttonwrapper"}));
		if (this._lastApprovedUser) {
			e.insert(n(!j, "user", "Another remote user: ", this._onUnapprovedUser.bind(this), i))
		} else {
			e.insert(i.wrap("td", {"class": "controlled-element"}).wrap("tr"))
		}
		this._userLoginError = new Element("div", {"class": "errormessage"});
		this._userLoginError.hide();
		this._userManager.update(e).insert(this._userLoginError);
		if (f) {
			if (this._lastLoginResponse.loginfailed && p != "") {
				this._userLoginError.update("Unable to authorize user: incorrect credentials");
				this._userLoginError.show()
			}
		}
	}, _populateGroupsAndData: function (d, c, e) {
		if (!e) {
			this._remoteServers[this._selectedServer]["noUpdates"] = true
		}
		this._displayGroupPicker(d);
		this._showApproveCheckbox()
	}, _displayGroupPicker: function (c) {
		if (!c) {
			c = this._userGroupsList;
			if (!this._userGroupsList) {
				return
			}
		} else {
			this._userGroupsList = c
		}
		console.log("Groups: " + stringifyObject(c));
		var d = new Element("table", {id: "user-list"});
		var e = function (l, h, k, m) {
			var n = new Element("tr");
			var i = new Element("input", {type: "radio", value: m, name: "select-group"});
			if (l) {
				i.checked = true
			}
			var j = new Element("label").insert(i).insert(k);
			n.insert(new Element("span", {"class": "fa fa-" + h}).wrap("td")).insert(j.wrap("td"));
			return n
		};
		if (!this._updatingExistingPatient()) {
			var f = "<span class ='hint'>None</span>";
			if (c.length == 0) {
				f += " (user __lastApprovedUser__ does not belong to any PhenoTips groups on the selected server)".replace("__lastApprovedUser__", this._lastApprovedUser)
			}
			d.insert(e(true, "user", f, "__self"));
			c.each(function (h) {
				d.insert(e(false, "group", h, h))
			})
		} else {
			var g = "Keep existing group(s)";
			g += " <span class ='hint'>(the group can't be changed when updating an existing patient)</span>";
			d.insert(e(true, "check", g, "__self"))
		}
		this._groupManager.update(d);
		if (this._remoteServers[this._selectedServer]["noUpdates"]) {
			this._disableUpdateOption()
		}
	}, _showApproveCheckbox: function () {
		this._checkBoxApprove.checked = false;
		this._checkBoxApprove.enable();
		this._approveElement.show()
	}, _populateConsentsList: function (c) {
		if (c == null || c.length == 0) {
			this._consentsSection.hide();
			return
		}
		var d = function (f, e) {
			this._pushResultSection.update("")
		}.bind(this);
		this._consentsManager.update("");
		this._updateConsentHint(this._selectedServer + " is configured with the following set of consents. Not all consents are required, but some data might not be uploaded if corresponding consent has not been granted.");
		this._consentsModule.init(this._consentsManager, "edit", c, false, d);
		this._consentsSection.show()
	}, _populateServerList: function (j) {
		this._remoteServers = {};
		var n = [];
		this._numAvailableServers = j.length;
		for (var h = 0; h < j.length; h++) {
			var e = j[h].serverinfo;
			var d = j[h].pushinfo;
			var c = e.serverID;
			n.push(c);
			e.serverURL = this._addHTTP(e.serverURL);
			var f = d ? d.lastPushAgeInHours : -1;
			var g = d ? d.remotePatientID : "";
			var m = d ? d.remotePatientGUID : "";
			var l = d ? (e.serverURL + d.remotePatientURL) : "";
			this._remoteServers[c] = {url: e.serverURL, desc: e.serverDescription, pushAgeHours: f, remoteID: g, remoteGUID: m, remoteURL: l}
		}
		n.sort();
		var k = this;
		this._selectServer(this._selectedServer)
	}, _selectServer: function (d, c) {
		this._selectedServer = d;
		var h = this._remoteServers[d];
		var m = new Element("a", {href: h.url, target: "_blank", "class": "remote-server-name"}).update(this._selectedServer);
		if (this._numAvailableServers == 1) {
			this._serverInfo.update("There is only one configured remote server: ")
		}
		var n = "";
		if (h.pushAgeHours !== undefined && h.pushAgeHours >= 0) {
			n = new Element("dd");
			var o = new Element("p", {id: "server-description"});
			var l = h.pushAgeHours;
			o.insert("This patient was uploaded to " + this._selectedServer);
			if (l < 1) {
				o.insert(" less than an hour ago")
			} else {
				if (l >= 48) {
					o.insert(" " + Math.floor(l / 24) + " days ago")
				} else {
					o.insert(" " + l + " hours ago")
				}
			}
			o.insert(" and was assigned patient ID ").insert(new Element("a", {href: h.remoteURL, target: "_blank"}).update(h.remoteID)).insert(".");
			o.insert("<br/>If data in the record has changed, push to __serverID__ again to update the record there.".replace("__serverID__", this._selectedServer));
			n.insert(o);
			var k = this;
			var e = new Element("p");
			var j = new Element("input", {type: "radio", value: "update", id: "choice-update-patient", name: "new-or-update"});
			j.checked = true;
			j.observe("change", function () {
				k._displayGroupPicker()
			});
			var g = new Element("label", {hidden: true}).insert(new Element("span", {"class": "fa fa-refresh"}).update(" ")).insert(j).insert("Update remote patient");
			var i = new Element("input", {type: "radio", value: "new", id: "choice-new-patient", name: "new-or-update"});
			i.observe("change", function () {
				k._displayGroupPicker()
			});
			var f = new Element("label", {hidden: true}).insert(new Element("span", {"class": "fa fa-plus-square"}).update(" ")).insert(i).insert("Create new remote patient");
			n.insert(g).insert(f)
		}
		this._serverInfo.update(new Element("dl").insert(m.clone(true).wrap("dt")).insert(h.desc && new Element("dd", {"class": "hint"}).update(h.desc) || "").insert(n || ""));
		this._approveMessage.update("I agree to push selected patient data to " + this._selectedServer);
		if (!c) {
			this._serverInfo.show();
			this._queryStoredUserName()
		}
	}, _onServerOptionChange: function () {
		var c = this._serverSelector.down("select");
		var d = c.options[c.selectedIndex].value;
		this._onNoServerSelected();
		if (d != "none") {
			this._selectServer(d)
		}
	}, _initServerSelector: function () {
		this._serverLoadMessages = new Element("div", {id: "server-load-messages"});
		this._serverLoadMessages.hide();
		var c = new Element("select", {id: "server-selector"});
		c.insert(new Element("option", {value: "none"}).update("Loading server list..."));
		c.observe("change", this._onServerOptionChange.bind(this));
		this._serverSelector = new Element("div", {id: "server-selector-div"});
		this._serverSelector.hide();
		this._serverSelector.update(c);
		this._serverInfo = new Element("div", {id: "server-info"});
		this._serverManager.update(this._serverLoadMessages).insert(this._serverSelector).insert(this._serverInfo)
	}, _initMainFormActions: function () {
		var e = this;
		var d = new Element("div", {"class": "buttons"});
		d.insert(new Element("input", {type: "hidden", name: "xaction", value: "push"}));
		d.insert(new Element("input", {type: "hidden", name: "patient", value: this._patientId}));
		var c = this._pushManyPatients ? "Next: Select patients and data fields to be pushed" : "Next: Select data fields to be pushed";
		d.insert(new Element("input", {type: "submit", name: "submit", value: c, "class": "button", id: "push_patient_button"}).wrap("span", {"class": "buttonwrapper"}));
		d.insert(new Element("input", {type: "button", name: "close", value: "Cancel", "class": "button secondary"}).wrap("span", {"class": "buttonwrapper"}));
		this._container.insert(d);
		this._pushResultSection = new Element("div", {"class": "section-contents"});
		this._container.insert(this._pushResultSection);
		this._cancelButton = d.down('input[name="close"]');
		this._cancelButton.observe("click", function (f) {
			e._dialog.closeDialog()
		});
		this._pushButton = d.down('input[name="submit"]');
		this._checkBoxApprove.observe("click", function (f) {
			e._pushResultSection.update("");
			if (e._checkBoxApprove.checked) {
				e._pushButton.enable()
			} else {
				e._pushButton.disable()
			}
		});
		this._container.observe("submit", function (f) {
			f.stop();
			e._pushSelectFieldsAndPatients()
		})
	}, _updatingExistingPatient: function () {
		var d = false;
		var c = document.getElementById("choice-update-patient");
		if (c) {
			d = c.checked
		}
		return d
	}, _selectPushNewPatient: function () {
		var c = document.getElementById("choice-update-patient");
		var d = document.getElementById("choice-new-patient");
		if (c && d) {
			c.checked = false;
			d.checked = true
		}
	}, _disableUpdateOption: function () {
		var e = document.getElementById("choice-new-patient");
		if (e) {
			e.checked = true
		}
		var c = document.getElementById("choice-update-patient-label");
		if (c) {
			var d = document.getElementById("server-description");
			d.insert("<p>Selected server does not allow updating existing patients, so can only push again to a new patient record.</p>");
			c.hide()
		}
	}, _pushPatient: function (f, d, g) {
		var i = this;
		if (i._pushManyPatients && (!d || !g)) {
			return
		}
		if (!i._pushManyPatients) {
			i._pushResultSection.update("")
		}
		if (f) {
			i._lastSelectedColumnList = f
		} else {
			f = i._lastSelectedColumnList
		}
		if (!f || f.length == 0) {
			i._pushResultSection.update(new Element("div", {"class": "errormessage"}).update("No columns were selected"));
			return
		}
		var d = d ? d : this._patientId;
		var h = {"do": "push", serverid: this._selectedServer, patientid: d};
		h.fields = f ? Object.toJSON(f) : Object.toJSON(this._patientFieldList);
		if (i._pushManyPatients) {
			h.guid = "auto"
		} else {
			if (this._updatingExistingPatient()) {
				h.guid = i._remoteServers[i._selectedServer].remoteGUID
			}
		}
		var e = $$('input:checked[type=radio][name="select-group"]')[0].value;
		if (e != "__self") {
			h.groupname = e
		}
		var c = {consents: i._consentsModule.listGrantedConsentIDs()};
		h.patientState = stringifyObject(c);
		console.log("PUSH request params: " + stringifyObject(h));
		new Ajax.Request(this._serviceURL, {method: i._container.method, parameters: h, onCreate: function () {
			i._disableInputs(true)
		}, onSuccess: function (k) {
			try {
				console.log("Got response: " + stringifyObject(k.responseJSON));
				var l = k.responseJSON;
				if (i._pushManyPatients) {
					g(l, d);
					return
				}
				if (l.status == "success") {
					i._checkBoxApprove.checked = false;
					var o = i._remoteServers[i._selectedServer].url + l.patienturl;
					i._remoteServers[i._selectedServer]["pushAgeHours"] = 0;
					i._remoteServers[i._selectedServer]["remoteID"] = l.patientid;
					i._remoteServers[i._selectedServer]["remoteGUID"] = l.patientguid;
					i._remoteServers[i._selectedServer]["remoteURL"] = o;
					if (i._updatingExistingPatient()) {
						var n = "(<a href='" + o + "' target='_blank'>click here to open remote patient</a>)";
						i._pushResultSection.update(new Element("div", {"class": "infomessage"}).update("Updated patient successfully. " + n))
					} else {
						var j = "<a href='" + o + "' target='_blank'>" + l.patientid + "</a>";
						i._pushResultSection.update(new Element("div", {"class": "infomessage"}).update("Pushed patient successfully, ID of the new patient on the remote server is " + j))
					}
					i._selectServer(i._selectedServer, true);
					i._displayGroupPicker()
				} else {
					if (l.updatesdisabled) {
						i._pushResultSection.update(i._generateFailedToPushPatient("Unable to update this patient - updates are disbaled on the remote server"))
					} else {
						if (l.invalidguid) {
							i._pushResultSection.update(i._generateFailedToPushPatient("Unable to update this patient - stored remote GUID is incorrect. Maybe the patient was deleted on the remote server&nbsp;", false, true))
						} else {
							if (l.accessdeniedguid) {
								i._pushResultSection.update(i._generateFailedToPushPatient("Unable to update this patient - access denied. Check if the given remote user has access rights to update the patient"))
							} else {
								if (l.accessdeniedguid) {
									i._pushResultSection.update(i._generateFailedToPushPatient("Unable to update this patient: access denied"))
								} else {
									if (l.cantconnect) {
										i._pushResultSection.update(i._generateFailedToPushPatient("Unable to connect to server", true))
									} else {
										if (l.missingconsent) {
											i._pushResultSection.update(i._generateFailedToPushPatient("Unable to update this patient - missing a required consent", true))
										} else {
											i._pushResultSection.update(i._generateFailedToPushPatient("Unable to update this patient", true))
										}
									}
								}
							}
						}
					}
				}
			} catch (m) {
				console.log("EXCEPTION: " + m);
				i._pushResultSection.update(i._generateFailedToPushPatient("Error updating patient ( __e__ )".replace("__e__", m), true))
			}
		}, onFailure: function (k) {
			if (i._pushManyPatients) {
				g({status: "error"}, d);
				return
			}
			var j = false;
			var l = k.statusText;
			if (k.statusText == "" || k.status == 12031) {
				l = "Server not responding";
				j = true
			}
			i._pushResultSection.update(i._generateFailedToPushPatient(l, j))
		}, on0: function (j) {
			if (i._pushManyPatients) {
				g({status: "error"}, d);
				return
			}
			j.request.options.onFailure(j)
		}, onComplete: function () {
			i._restoreInputs();
			if (!i._checkBoxApprove.checked) {
				i._pushButton.disable()
			}
		}})
	}, _addHTTP: function (c) {
		if (!/^(f|ht)tps?:\/\//i.test(c)) {
			c = "http://" + c
		}
		return c
	}, _pushSelectFieldsAndPatients: function () {
		var j = this;
		var g = function (k, m) {
			j._checkBoxApprove.checked = false;
			var o = new Element("div", {"class": "multi-push-results infomessage"});
			j._pushResultSection.update(o);
			var n = 0;
			var l = function (q, r) {
				if (q && r) {
					if (q.status != "success") {
						o.className = "multi-push-results errormessage";
						if (q.cantconnect) {
							o.insert(" Unable to connect to server");
							return
						}
						var s = "failed.";
						if (q.invalidguid) {
							s = "Unable to update: stored remote GUID is incorrect"
						} else {
							if (q.accessdeniedguid) {
								s = "Unable to update: access denied."
							} else {
								if (q.missingconsent) {
									s = "Unable to update this patient - missing a required consent"
								}
							}
						}
						o.insert(" " + s + "<br/>")
					} else {
						o.innerHTML = o.innerHTML.replace(/Pushing (\w+?)\.\.\.$/, "");
						var u = j._remoteServers[j._selectedServer].url + q.patienturl;
						var t = "<a href='" + u + "' target='_blank'>" + q.patientid + "</a>";
						o.insert("<div class='pushed-ok-message'>" + "Pushed __prevPatientID__ successfully, remote patient ID is __linkToRemote__".replace("__prevPatientID__", r).replace("__linkToRemote__", t) + "</div>")
					}
				}
				if (n < k.length) {
					var p = k[n++];
					o.insert("Pushing __nextPatientID__...".replace("__nextPatientID__", p));
					j._pushPatient(m, p, l)
				}
			};
			l()
		};
		var d = function (k, l) {
			if (k.length == 0) {
				return
			}
			var m = "Do you want to push the following __numPatients__ patients to __selectServer__?".replace("__numPatients__", k.length).replace("__selectServer__", j._selectedServer) + "<br/><div class='plainmessage multi-push-patient-list'><ol>";
			k.each(function (n) {
				m += "<li>" + n + "</li>"
			});
			m += "</ol></div>";
			new XWiki.widgets.ConfirmationBox({onYes: function () {
				g(k, l)
			}, }, {confirmationText: m, showCancelButton: false})
		};
		if (j._pushManyPatients) {
			var i = $("phenotips_export");
			if (!i) {
				return
			}
			var f = new b.widgets.ModalPopup('<img src="resources/icons/xwiki/ajax-loader-large.gif"/>', false, {title: "Select patients and fields to be pushed", verticalPosition: "top", removeOnClose: true, extraClassName: "export-dialog"});
			f.showDialog();
			var e = function () {
				alert("Failed to get the list of patients to be pushed")
			};
			new Ajax.Request(new XWiki.Document("ExportPreferences", "PhenoTips").getURL("get", "space=" + /space=([^&]+)/.exec(i.href)[1] + "&push=true&multipatient=true&remoteserver=" + this._selectedServer), {parameters: {enabledFields: this._lastLoginResponse.serverfields}, onSuccess: function (l) {
				var k = f.dialogBox._x_contentPlug;
				k.update(l.responseText);
				k.__dialog = f;
				document.fire("xwiki:dom:updated", {elements: [k], pushPreferences: k, pushMulti: true, callbackOK: d, callbackFail: e})
			}})
		} else {
			var f = new b.widgets.ModalPopup('<img src="resources/icons/xwiki/ajax-loader-large.gif"/>', false, {title: "Select fields to be pushed", verticalPosition: "top", removeOnClose: true, extraClassName: "narrow-export-dialog export-dialog"});
			f.showDialog();
			var c = function () {
				alert("Failed to get the list of fields to be pushed")
			};
			var h = function (k) {
				j._pushPatient(k)
			};
			new Ajax.Request(new XWiki.Document("ExportPreferences", "PhenoTips").getURL("get", "push=true&singlepatient=false&remoteserver=" + this._selectedServer), {parameters: {enabledFields: this._lastLoginResponse.serverfields}, onSuccess: function (l) {
				var k = f.dialogBox._x_contentPlug;
				k.update(l.responseText);
				k.__dialog = f;
				document.fire("xwiki:dom:updated", {elements: [k], pushPreferences: k, pushMulti: false, callbackOK: h, callbackFail: c})
			}})
		}
	}});
	return b
}(PhenoTips || {}));
["xwiki:dom:updated"].each(function (a) {
	document.observe(a, function (g) {
		if (!g.memo || !g.memo.pushPreferences || !g.memo.callbackOK) {
			return
		}
		var d = g.memo.pushPreferences.__dialog;
		var c = g.memo.callbackOK;
		var f = g.memo.callbackFail;
		var e = g.memo.pushMulti;
		var h = $("export_cancel");
		h && h.observe("click", function (i) {
			d.closeDialog()
		});
		var b = g.memo.pushMulti ? $("push-multiple-patients") : $("push-patient");
		b && b.observe("click", function (n) {
			n.stop();
			var m = b.up("form");
			if (m) {
				var k = [];
				var j = m.down(".push-fields");
				var o = j.select('input[name="columns"]');
				o.each(function (q) {
					if (q.checked) {
						k.push(q.identify().replace("columns_", ""))
					}
				});
				if (!e) {
					d.closeDialog();
					c(k);
					return
				}
				var p = $("filter-match-count");
				var l = "/get/PhenoTips/ExportFilter?list=true&" + m.serialize();
				var i = new Ajax.Request(l, {method: "get", onSuccess: function (r) {
					var q = [];
					r.responseJSON.each(function (s) {
						q.push(s.replace("data.", ""))
					});
					c(q, k)
				}, onFailure: function (q) {
					f && f()
				}})
			}
			d.closeDialog()
		})
	})
});
document.observe("xwiki:dom:loaded", function () {
	new PhenoTips.widgets.PushPatientWidget()
});
function stringifyObject(a) {
	return _printObjectInternal(a, 1)
}
function _printObjectInternal(d, e) {
	if (e > 10) {
		return"...[too deep, possibly a recursive object]..."
	}
	var b = "";
	if (typeof d == "object") {
		if (Object.prototype.toString.call(d) === "[object Array]") {
			b = "[";
			for (var c = 0; c < d.length; c++) {
				if (c > 0) {
					b += ", "
				}
				b += _printObjectInternal(d[c], e + 1)
			}
			b += "]"
		} else {
			b = "{";
			var a = 0;
			if (e == 0) {
				b += "\n"
			}
			for (property in d) {
				if (!d.hasOwnProperty(property)) {
					continue
				}
				if (e != 0 && a != 0) {
					b += ", "
				}
				b += property + ": " + _printObjectInternal(d[property], e + 1);
				if (e == 0) {
					b += "\n"
				}
				a++
			}
			b += "}"
		}
	} else {
		if (typeof d == "string") {
			b = "'" + d + "'"
		} else {
			b = "" + d
		}
	}
	return b
};