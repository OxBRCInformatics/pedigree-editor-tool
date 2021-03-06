var XWiki = (function (c) {
	var a = function (f) {
		if (!f) {
			return c.currentDocument
		} else {
			if (typeof f == "string") {
				var e = c.Model.resolve(f, c.EntityType.DOCUMENT);
				var d = e.name;
				var g = e.extractReferenceValue(c.EntityType.SPACE);
				var h = e.extractReferenceValue(c.EntityType.WIKI);
				return new c.Document(d, g, h)
			}
		}
		return f
	};
	c.DocumentLock = Class.create({initialize: function (e) {
		this._document = a(e);
		var g = this.unlock.bind(this);
		Event.observe(window, "unload", g);
		Event.observe(window, "pagehide", g);
		$("tmLogout") && $("tmLogout").down("a") && $("tmLogout").down("a").observe("click", g);
		var f = this.setLocked.bind(this, false);
		$$("form.withLock").each(function (h) {
			h.observe("submit", f)
		});
		var d = new c.DocumentReference(this._document.wiki, this._document.space, this._document.page);
		c.DocumentLock._instances[c.Model.serialize(d)] = this
	}, lock: function () {
		if (!this._locked) {
			this._locked = true;
			new Ajax.Request(this._getURL("lock"), {method: "get"})
		}
	}, unlock: function () {
		if (this._locked) {
			this._locked = false;
			new Ajax.Request(this._getURL("cancel"), {method: "get", asynchronous: false})
		}
	}, setLocked: function (d) {
		this._locked = !!d
	}, isLocked: function () {
		return this._locked
	}, _getURL: function (d) {
		return this._document.getURL(d, "ajax=1&action=" + c.contextaction + "&" + (c.docvariant || ""))
	}});
	c.DocumentLock._instances = {};
	c.DocumentLock.get = function (e) {
		e = a(e);
		var d = new c.DocumentReference(e.wiki, e.space, e.page);
		return c.DocumentLock._instances[c.Model.serialize(d)]
	};
	var b = function () {
		c.EditLock = new c.DocumentLock();
		c.EditLock.lock();
		return true
	};
	(c.domIsLoaded && b()) || document.observe("xwiki:dom:loaded", b);
	return c
}(XWiki || {}));