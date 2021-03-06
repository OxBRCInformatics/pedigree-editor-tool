var XWiki = (function (d) {
	var c = d.actionButtons = d.actionButtons || {};
	c.EditActions = Class.create({initialize: function () {
		this.addListeners();
		this.addShortcuts();
		this.addValidators()
	}, addListeners: function () {
		$$("input[name=action_cancel]").each(function (e) {
			e.observe("click", this.onCancel.bindAsEventListener(this))
		}.bind(this));
		$$("input[name=action_preview]").each(function (e) {
			e.observe("click", this.onPreview.bindAsEventListener(this))
		}.bind(this));
		$$("input[name=action_save]").each(function (e) {
			e.observe("click", this.onSaveAndView.bindAsEventListener(this))
		}.bind(this));
		$$("input[name=action_saveandcontinue]").each(function (e) {
			e.observe("click", this.onSaveAndContinue.bindAsEventListener(this))
		}.bind(this))
	}, addShortcuts: function () {
		var e = {action_cancel: "$services.localization.render('core.shortcuts.edit.cancel')", action_preview: "$services.localization.render('core.shortcuts.edit.preview')", action_edit: "$services.localization.render('core.shortcuts.edit.backtoedit')", action_inline: "$services.localization.render('core.shortcuts.edit.backtoedit')", action_save: "$services.localization.render('core.shortcuts.edit.saveandview')", action_propupdate: "$services.localization.render('core.shortcuts.edit.saveandview')", action_saveandcontinue: "$services.localization.render('core.shortcuts.edit.saveandcontinue')"};
		for (var f in e) {
			var g = $$("input[name=" + f + "]");
			if (g.size() > 0) {
				shortcut.add(e[f], function () {
					this.click()
				}.bind(g.first()), {propagate: false})
			}
		}
	}, validators: new Array(), addValidators: function () {
		var e = $("body").select("input.required");
		for (var h = 0; h < e.length; h++) {
			var f = e[h];
			var g = new LiveValidation(f, {validMessage: ""});
			g.add(Validate.Presence, {failureMessage: "$services.localization.render('core.validation.required.message')"});
			g.validate();
			this.validators.push(g)
		}
	}, validateForm: function (g) {
		for (var f = 0; f < this.validators.length; f++) {
			if (!this.validators[f].validate()) {
				return false
			}
		}
		var h = g.comment;
		if (h && ($xwiki.isEditCommentSuggested() || $xwiki.isEditCommentMandatory())) {
			while (h.value == "") {
				var e = prompt("$services.localization.render('core.comment.prompt')", "");
				if (e === null) {
					return false
				}
				h.value = e;
				if (!$xwiki.isEditCommentMandatory()) {
					break
				}
			}
		}
		return true
	}, onCancel: function (g) {
		g.stop();
		this.notify(g, "cancel");
		var f = g.element().form.action;
		if (typeof f != "string") {
			f = g.element().form.attributes.getNamedItem("action");
			if (f) {
				f = f.nodeValue
			} else {
				f = window.self.location.href
			}
		}
		var i = f.split("#", 2);
		var k = (i.length == 2) ? i[1] : "";
		f = i[0];
		if (f.indexOf("?") == -1) {
			f += "?"
		}
		var j = "&action_cancel=true";
		var h = g.element().form.elements.xredirect;
		var e = h ? "&xredirect=" + escape(h.value) : "";
		d.EditLock && d.EditLock.setLocked(false);
		window.location = f + j + e + k
	}, onPreview: function (e) {
		if (!this.validateForm(e.element().form)) {
			e.stop()
		} else {
			this.notify(e, "preview")
		}
	}, onSaveAndView: function (e) {
		if (!this.validateForm(e.element().form)) {
			e.stop()
		} else {
			this.notify(e, "save", {"continue": false})
		}
	}, onSaveAndContinue: function (e) {
		if (!this.validateForm(e.element().form)) {
			e.stop()
		} else {
			this.notify(e, "save", {"continue": true})
		}
	}, notify: function (e, f, g) {
		document.fire("xwiki:actions:" + f, Object.extend({originalEvent: e, form: e.element().form}, g || {}));
		if (e.stopped) {
			e.stop()
		}
	}});
	c.AjaxSaveAndContinue = Class.create({initialize: function () {
		this.createMessages();
		this.addListeners()
	}, createMessages: function () {
		this.savingBox = new d.widgets.Notification("$escapetool.javascript($services.localization.render('core.editors.saveandcontinue.notification.inprogress'))", "inprogress", {inactive: true});
		this.savedBox = new d.widgets.Notification("$escapetool.javascript($services.localization.render('core.editors.saveandcontinue.notification.done'))", "done", {inactive: true});
		this.failedBox = new d.widgets.Notification('$escapetool.javascript($services.localization.render("core.editors.saveandcontinue.notification.error", ["<span id=""ajaxRequestFailureReason""/>"]))', "error", {inactive: true})
	}, addListeners: function () {
		document.observe("xwiki:actions:save", this.onSave.bindAsEventListener(this))
	}, onSave: function (e) {
		if (e.stopped) {
			return
		}
		if (e.memo["continue"]) {
			if (typeof(e.memo.originalEvent) != "undefined") {
				e.memo.originalEvent.stop()
			}
			this.form = $(e.memo.form);
			this.savedBox.hide();
			this.failedBox.hide();
			this.savingBox.show();
			var f = new Hash(this.form.serialize({hash: true, submit: "action_saveandcontinue"}));
			f.set("minorEdit", "1");
			if (!Prototype.Browser.Opera) {
				f.set("ajax", "true")
			}
			new Ajax.Request(this.form.action, {method: "post", parameters: f.toQueryString(), onSuccess: this.onSuccess.bindAsEventListener(this), on1223: this.on1223.bindAsEventListener(this), on0: this.on0.bindAsEventListener(this), onFailure: this.onFailure.bind(this)})
		}
	}, on1223: function (e) {
		e.request.options.onSuccess(e)
	}, on0: function (e) {
		e.request.options.onFailure(e)
	}, onSuccess: function (e) {
		if (this.form && this.form.template) {
			this.form.template.disabled = true;
			this.form.template.value = ""
		}
		this.savingBox.replace(this.savedBox);
		document.fire("xwiki:document:saved")
	}, onFailure: function (e) {
		this.savingBox.replace(this.failedBox);
		if (e.statusText == "" || e.status == 12031) {
			$("ajaxRequestFailureReason").update("Server not responding")
		} else {
			if (e.getHeader("Content-Type").match(/^\s*text\/plain/)) {
				$("ajaxRequestFailureReason").update(e.responseText)
			} else {
				$("ajaxRequestFailureReason").update(e.statusText)
			}
		}
		document.fire("xwiki:document:saveFailed", {response: e})
	}});
	function b() {
		new c.EditActions();
		if (!$("body").hasClassName("previewbody")) {
			new c.AjaxSaveAndContinue()
		}
		return true
	}

	(d.domIsLoaded && b()) || document.observe("xwiki:dom:loaded", b);
	function a() {
		if (typeof(Wysiwyg) == "undefined") {
			return
		}
		var h = Wysiwyg.getInstances();
		for (var f in h) {
			var g = h[f];
			var e = g.getPlainTextArea();
			if (e && !e.disabled) {
				$(f).value = e.value
			} else {
				g.getCommandManager().execute("submit")
			}
		}
	}

	document.observe("xwiki:actions:save", a);
	document.observe("xwiki:actions:preview", a);
	return d
}(XWiki || {}));