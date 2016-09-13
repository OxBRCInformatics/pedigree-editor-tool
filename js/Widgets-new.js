var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.SolrQueryProcessor = Class.create({
		initialize: function (queryFields, restriction) {
			this.queryFields = queryFields;
			this.restriction = restriction;
		},

		processQuery: function (query) {
			return this.inflateQuery(query);
		},

		generateParameters: function (query) {
			var parameters = {'defType': 'edismax', 'spellcheck.collate': true, 'spellcheck': true, 'lowercaseOperators': false};
			if (this.setupMandatoryQuery(query, parameters)) {
				return parameters;
			}
			this.restrictQuery(query, parameters);
			this.setupQueryFields(query, parameters);
			return parameters;
		},

		setupMandatoryQuery: function (query, parameters) {
			var txt = query.strip();
			var mandatoryQuery = "";
			var hasMandatoryFields = false;
			for (var field in this.queryFields) {
				var fieldOptions = this.queryFields[field];
				var activationRegex = fieldOptions['activationRegex'];
				if (!fieldOptions['mandatory'] || !activationRegex || !txt.match(activationRegex)) {
					continue;
				}
				mandatoryQuery += field + ":" + (fieldOptions['transform'] ? fieldOptions['transform'](query) : query) + " ";
				hasMandatoryFields = true;
			}
			if (mandatoryQuery) {
				parameters.fq = mandatoryQuery.strip();
			}
			return hasMandatoryFields;
		},

		restrictQuery: function (query, parameters) {
			if (!this.restriction) {
				return;
			}
			var result = "";
			for (var rField in this.restriction) {
				var restrictionString = (rField.substring(0, 1) == '-' ? '-' : '+') + "(";
				for (var i = 0; i < this.restriction[rField].length; ++i) {
					restrictionString += rField.replace(/^-/, '') + ":" + this.restriction[rField][i].replace(/:/g, "\\:") + " ";
				}
				restrictionString = restrictionString.strip() + ") ";
				result += restrictionString;
			}
			if (result) {
				parameters.fq = result.strip();
			}
		},

		setupQueryFields: function (query, parameters) {
			var txt = query.strip();
			var wordFields = "";
			var phraseFields = "";
			var boostQuery = "";
			var lastWord = query.replace(/.*\W/g, '');
			for (var field in this.queryFields) {
				var fieldOptions = this.queryFields[field];
				var activationRegex = fieldOptions['activationRegex'];
				if (activationRegex && !txt.match(activationRegex)) {
					continue;
				}
				if (fieldOptions['wordBoost']) {
					wordFields += field + "^" + fieldOptions['wordBoost'] + " ";
				}
				if (fieldOptions['phraseBoost']) {
					phraseFields += field + "^" + fieldOptions['phraseBoost'] + (fieldOptions['phraseSlop'] ? "~" + fieldOptions['phraseSlop'] : "") + " ";
				}
				if (lastWord && fieldOptions['stubBoost']) {
					boostQuery += field + ":" + lastWord.replace(/:/g, "\\:") + "*^" + fieldOptions['stubBoost'] + " ";
				}
			}
			if (wordFields) {
				parameters.qf = wordFields.strip();
			}
			if (phraseFields) {
				parameters.pf = phraseFields.strip();
			}
			if (boostQuery) {
				parameters.bq = boostQuery.strip();
			}
		},

		inflateQuery: function (query) {
			var lastWord = query.replace(/.*\W/g, '');
			if (!lastWord) {
				return query;
			}
			var result = query;

			for (var field in this.queryFields) {
				if (this.queryFields[field].stubTrigger) {
					result += " " + field + ":" + lastWord.replace(/:/g, "\\:") + "*";
				}
			}
			return result.strip();
		}
	});
	return PhenoTips;
}(PhenoTips || {}));


var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.OntologyBrowser = Class.create({
		options: {
			script: "${xwiki.getURL('PhenoTips.SolrService', 'get', 'sort=nameSort asc&start=0&rows=10000')}&",
			varname: "q",
			method: "post",
			json: true,
			responseFormat: "application/json",
			resultsParameter: "rows",
			resultId: "id",
			resultValue: "name",
			resultCategory: "term_category",
			resultParent: {
				selector: 'is_a',
				processingFunction: function (text) {
					var data = {};
					data.id = text.replace(/\s+/gm, ' ').replace(/(HP:[0-9]+)\s*!\s*(.*)/m, "$1");
					data.value = text.replace(/\s+/gm, ' ').replace(/(HP:[0-9]+)\s*!\s*(.*)/m, "$2");
					return data;
				}
			},
			noresults: "No sub-terms",
			targetQueryProcessor: typeof(PhenoTips.widgets.SolrQueryProcessor) == "undefined" ? null : new PhenoTips.widgets.SolrQueryProcessor({
				'id': {'activationRegex': /^HP:[0-9]+$/i, 'mandatory': true, 'transform': function (query) {
					return query.toUpperCase().replace(/:/g, "\\:");
				}}
			}),
			expandQueryProcessor: typeof(PhenoTips.widgets.SolrQueryProcessor) == "undefined" ? null : new PhenoTips.widgets.SolrQueryProcessor({
				'is_a': {'activationRegex': /^HP:[0-9]+$/i, 'mandatory': true, 'transform': function (query) {
					return query.toUpperCase().replace(/:/g, "\\:");
				}}
			}),
			showParents: true,
			showRoot: true,
			enableSelection: true,
			enableBrowse: true,
			isTermSelected: function (id) {
				return false;
			},
			unselectTerm: function (id) {
			},

			defaultEntryAction: 'browse' /* {browse, select} */
		},

		initialize: function (suggest, container, options) {
			this.options = Object.extend(Object.clone(this.options), options || { });
			this.suggest = suggest;
			this.loadingMessage = new Element('div', {'class': 'plainmessage loading'}).update("Loading...");
			if (container) {
				this.container = container;
			} else {
				this.container = new PhenoTips.widgets.ModalPopup(this.loadingMessage, {}, {
					idPrefix: 'ontology-browser-window-',
					title: "Related terms",
					backgroundColor: "#ffffff",
					verticalPosition: "top",
					extraDialogClassName: "dialog-ontology-browser",
					removeOnClose: true
				});
				this.options.modal = true;
			}
			this._obrowserExpandEventHandler = this._obrowserExpandEventHandler.bindAsEventListener(this);
		},

		load: function (id) {
			this.setContent(this.loadingMessage);
			var query = id;
			var parameters = {};
			if (this.options.targetQueryProcessor != null && typeof(this.options.targetQueryProcessor.generateParameters) == "function") {
				parameters = this.options.targetQueryProcessor.generateParameters(query);
			}
			if (this.options.targetQueryProcessor != null && typeof(this.options.targetQueryProcessor.processQuery) == "function") {
				query = this.options.targetQueryProcessor.processQuery(query);
			}
			var url = this.options.script + this.options.varname + "=" + encodeURIComponent(query);
			var headers = {};
			headers.Accept = this.options.responseFormat;

			var ajx = new Ajax.Request(url, {
				method: this.options.method,
				parameters: parameters,
				requestHeaders: headers,
				onSuccess: function (response) {
					this.setContent(this.buildTree(this._getDataFromResponse(response)));
					this.__crtRoot = id;
					if (this.container.content) {
						Event.fire(document, 'xwiki:dom:updated', {'elements': [this.container.contentContainer || this.container.content]});
					}
				}.bind(this),
				onFailure: function (response) {
					this.setContent("Failed to retrieve data : " + response.statusText);
					this.__crtRoot = '';
				}.bind(this)
			});
		},

		expandTo: function (termId, categories) {
			if (categories.indexOf(this.__crtRoot) == -1) {
				// not in the right tree, nothing to do
				return;
			}
			this._expandToStep(termId, categories.without(this.__crtRoot, termId));
		},

		_expandToStep: function (termId, categories) {
			var _this = this;
			//alert ("expanding " + termId + " " + categories);
			var target = this.container.contentContainer.down('li.entry input.select-tool[value="' + termId.replace(/"/g, '\\"') + '"]');
			if (target) {
				return;
			}
			var finishedStep = false;
			categories.each(function (category) {
				if (finishedStep) {
					return
				}
				var categoryInput = _this.container.contentContainer.down('li.entry input.select-tool[value="' + category.replace(/"/g, '\\"') + '"]');
				if (categoryInput) {
					//alert ("start expanding " + category + " " + categories);
					var categoryEntry = categoryInput.up('li');
					if (categoryEntry.hasClassName('collapsed') || !categoryEntry.down('.descendents')) {
						Event.observe(categoryEntry, "obrowser:expand:finished", function (event) {
							Event.stopObserving(categoryEntry, "obrowser:expand:finished");
							_this._expandToStep(termId, categories.without(category));
						});
						_this._toggleExpandState(categoryEntry);
						finishedStep = true;
					}
				}
			});
		},

		expand: function (element, doPopulate) {
			var query = element.__termId;
			var parameters = {};
			if (this.options.expandQueryProcessor != null && typeof(this.options.expandQueryProcessor.generateParameters) == "function") {
				parameters = this.options.expandQueryProcessor.generateParameters(query);
			}
			if (this.options.expandQueryProcessor != null && typeof(this.options.expandQueryProcessor.processQuery) == "function") {
				query = this.options.expandQueryProcessor.processQuery(query);
			}
			var url = this.options.script + this.options.varname + "=" + encodeURIComponent(query);
			var headers = {};
			headers.Accept = this.options.responseFormat;

			var ajx = new Ajax.Request(url, {
				method: this.options.method,
				requestHeaders: headers,
				parameters: parameters,
				onCreate: function () {
					this._lockExpandTool(element)
				}.bind(this),
				onSuccess: function (response) {
					var memo = {};
					if (doPopulate) {
						var newAdditions = this.buildDescendentsList(this._getDataFromResponse(response));
						element.insert({'bottom': newAdditions});
						Event.fire(document, "obrowser:content:added", {added: newAdditions, obrowser: this});
						Event.fire(element, "obrowser:expand:finished");
						Event.fire(this.container.contentContainer || document, "obrowser:expand:finished");
						Event.fire(document, 'xwiki:dom:updated', {'elements': [newAdditions]});
						//memo.data = this.buildDescendentsList(this._getDataFromResponse(response));
						//Event.fire(element, 'obrowser:expand:done', memo);
					} else {
						memo.count = this.countDescendents(this._getDataFromResponse(response));
						//Event.fire(element, 'obrowser:count:done', memo);
					}
					if ((memo.count === 0) || (doPopulate && !element.down('.descendents .entry, .error'))) {
						element.addClassName('collapsed');
						var expandTool = element.down('.expand-tool');
						if (expandTool) {
							expandTool.update(this._getExpandCollapseSymbol(true)).addClassName('disabled');
							expandTool.stopObserving('click');
						}
					}
					Event.fire(document, "ms:popup:content-updated", {popup: this.container});
				}.bind(this),
				onFailure: function (response) {
					Event.fire(element, 'obrowser:expand:failed', {data: new Element('div', {'class': 'error'}).update("Failed to retrieve data : " + response.statusText), count: -1});
				},
				onComplete: function () {
					this._unlockExpandTool(element)
				}.bind(this)
			});
		},

		_getDataFromResponse: function (response) {
			if (this.options.json) {
				return response.responseJSON;
			}
			return response.responseXML;
		},
		_getResultset_json: function (data, fieldName) {
			return data && data[fieldName] || [];
		},
		_getResultFieldValue_json: function (data, fieldName) {
			return data && data[fieldName] || '';
		},
		_getResultFieldValueAsArray_json: function (data, fieldName) {
			return new Array(data && data[fieldName] || '').flatten();
		},
		_getResultset_xml: function (data, selector) {
			var elements = data && data.getElementsByTagName(selector);
			return elements;
		},
		_getResultFieldValue_xml: function (data, selector) {
			var element = data && Element.down(data, selector);
			return element && element.firstChild && element.firstChild.nodeValue || '';
		},
		_getResultFieldValueAsArray_xml: function (data, selector) {
			var result = new Array();
			if (data) {
				Element.select(data, selector).each(function (item) {
					var value = item.firstChild && item.firstChild.nodeValue;
					if (value) {
						result.push(value);
					}
				});
			}
			return result;
		},
		_getResultset: function (data, fieldName) {
			if (this.options.json) {
				return this._getResultset_json(data, fieldName);
			}
			return this._getResultset_xml(data, fieldName);
		},
		_getResultFieldValue: function (data, fieldName) {
			if (this.options.json) {
				return this._getResultFieldValue_json(data, fieldName);
			}
			return this._getResultFieldValue_xml(data, fieldName);
		},
		_getResultFieldValueAsArray: function (data, fieldName) {
			if (this.options.json) {
				return this._getResultFieldValueAsArray_json(data, fieldName);
			}
			return this._getResultFieldValueAsArray_xml(data, fieldName);
		},

		buildTree: function (data) {
			var results = this._getResultset(data, this.options.resultsParameter);
			if (results.length == 0) {
				return new Element('div', {'class': 'error'}).update(this.options.noresults);
			}
			var targetResult = results[0];
			var newContent = new Element('div');
			if (this.options.showParents) {
				var parents = new Element('ul', {'class': 'parents'});
				this._getResultFieldValueAsArray(targetResult, this.options.resultParent.selector).each(function (item) {
					var text = item;
					var data = {};
					if (typeof (this.options.resultParent.processingFunction) == "function") {
						data = this.options.resultParent.processingFunction(text);
					}
					parents.insert({'bottom': this._createParentBranch(data)});
				}.bind(this));
				if (parents.hasChildNodes()) {
					newContent.insert({'top': parents});
				}
				Event.fire(document, "obrowser:content:added", {added: parents, obrowser: this});
			}
			var data = {
				id: this._getResultFieldValue(targetResult, this.options.resultId),
				value: this._getResultFieldValue(targetResult, this.options.resultValue),
				category: this._generateEntryCategory(targetResult)
			}
			var root = this._createRoot(data);
			newContent.insert({'bottom': root});
			Event.fire(document, "obrowser:content:added", {added: root, obrowser: this});
			//this._toggleExpandState(root);
			return newContent;
		},

		countDescendents: function (xml) {
			return this._getResultset(xml, this.options.resultsParameter).length;
		},

		buildDescendentsList: function (xml) {
			var results = this._getResultset(xml, this.options.resultsParameter);
			var list = new Element('ul', {'class': 'descendents'});
			for (var i = 0; i < results.length; i++) {
				var data = {
					id: this._getResultFieldValue(results[i], this.options.resultId),
					value: this._getResultFieldValue(results[i], this.options.resultValue),
					category: this._generateEntryCategory(results[i])
				};
				list.insert({'bottom': this._createDescendentBranch(data)});
			}
			if (list.hasChildNodes()) {
				return list;
			}
			return new Element('div', {'class': 'descendents hint empty'}).update(this.options.noresults);
		},

		_createBranch: function (eltName, className, data, expandable) {
			var element = new Element(eltName, {'class': 'entry ' + className});
			element.__termId = data.id;
			element.__termCategory = data.category;
			var wrapper = new Element('div', {'class': 'entry-data'});
			wrapper.insert({'bottom': this._generateEntryTitle(data.id, data.value)});
			var entryTools = new Element('span', {'class': 'entry-tools'});
			entryTools.observe('click', function (event) {
				event.stop()
			}); // don't forward click events
			wrapper.insert({'bottom': entryTools});
			element.update(wrapper);

			if (!this._isRootEntry(element)) {
				if (this.options.defaultEntryAction == 'browse') {
					wrapper.down('.info').observe('click', this._browseEntry.bindAsEventListener(this));
				}
			}
			entryTools.insert(new Element('span', {'class': 'fa fa-info-circle phenotype-info xHelpButton', title: data.id}));

			if (this.options.enableSelection) {
				element.__selectTool = new Element('input', {'type': 'checkbox', name: 'term_selector', value: data.id, 'class': 'select-tool'});
				wrapper.insert({'top': element.__selectTool});
				if (this.options.isTermSelected(element.__termId)) {
					element.addClassName('accepted');
					element.__selectTool.checked = 'checked';
				}
				element.__selectTool.observe('click', this._toggleEntrySelection.bindAsEventListener(this));
				if (this.options.defaultEntryAction == 'select') {
					wrapper.down('.info').observe('click', this._toggleEntrySelection.bindAsEventListener(this));
				}
			}

			if (expandable) {
				var expandTool = new Element('span', {'class': 'expand-tool'}).update(this._getExpandCollapseSymbol(!element.hasClassName('root')));
				expandTool.observe('click', function (event) {
					var entry = event.element().up('.entry');
					if (!this._isExpandToolLocked(entry)) {
						this._toggleExpandState(entry);
					}
				}.bindAsEventListener(this));
				var expandOnSelect = function (e) {
					if (!this._isExpandToolLocked(element) && e.memo.selected == "yes") {
						this._expandEntry(element);
					}
				}
				element.observe('obrowser:entry:selected', expandOnSelect.bindAsEventListener(this));
				element.observe('ynpicker:selectionChanged', expandOnSelect.bindAsEventListener(this));
				wrapper.insert({'top': expandTool});
				this.expand(element, element.hasClassName('root'));
				//element.observe('obrowser:expand:done', this._obrowserExpandEventHandler);
				//element.observe('obrowser:count:done', this._obrowserExpandEventHandler);
				//element.observe('obrowser:expand:failed', this._obrowserExpandEventHandler);
			}
			return element;
		},

		_generateEntryTitle: function (id, value) {
			return  new Element('span', {'class': 'info'}).insert(
				{'bottom': new Element('span', {'class': 'key'}).update('[' + id + ']')}).insert(
				{'bottom': ' '}).insert(
				{'bottom': new Element('span', {'class': 'value'}).update(value)});
		},

		_generateEntryCategory: function (xmlFragment) {
			var category = new Element("span", {'class': 'hidden term-category'});
			if (this.options.resultCategory) {
				this._getResultFieldValueAsArray(xmlFragment, this.options.resultCategory).each(function (c) {
					category.insert(new Element('input', {'type': 'hidden', 'value': c}));
				});
			}
			if (category.hasChildNodes()) {
				return category;
			} else {
				return null;
			}
		},

		_expandEntry: function (target) {
			if (!target) return;
			if (!target.down('.descendents')) {
				//This is the first expansion, fetch subterms
				target.down(".error") && target.down(".error").remove();
				this.expand(target, true);
			} else {
				Event.fire(target, "obrowser:expand:finished");
			}
			target.removeClassName('collapsed');
			target.down('.expand-tool').update(this._getExpandCollapseSymbol(false));
		},
		_collapseEntry: function (target) {
			if (!target) return;
			target.addClassName('collapsed');
			Event.fire(target, "obrowser:expand:finished");
			target.down('.expand-tool').update(this._getExpandCollapseSymbol(true));
		},
		_toggleExpandState: function (target) {
			if (target) {
				if (!target.down('.descendents') || target.hasClassName('collapsed')) {
					this._expandEntry(target);
				} else {
					this._collapseEntry(target);
				}
			}
		},

		_obrowserExpandEventHandler: function (event) {
			var element = event.element();
			if (!event.memo) {
				return;
			}
			if (event.memo.data) {
				element.insert({'bottom': event.memo.data});
				element.stopObserving('obrowser:expand:done', this._obrowserExpandEventHandler);
			} else if (typeof (event.memo.count) != "undefined") {
				element.stopObserving('obrowser:count:done', this._obrowserExpandEventHandler);
			}
			element.stopObserving('obrowser:expand:failed', this._obrowserExpandEventHandler);
			if ((event.memo.count == "0") || (!element.hasClassName('root') && event.memo.data && !element.down('.descendents .entry, .error'))) {
				element.addClassName('collapsed');
				var expandTool = element.down('.expand-tool');
				if (expandTool) {
					expandTool.update(this._getExpandCollapseSymbol(true)).addClassName('disabled');
					expandTool.stopObserving('click');
				}
			}
			this._unlockExpandTool(element);
			Event.fire(document, "ms:popup:content-updated", {popup: this.container});
			if (event.memo.data) {
				Event.fire(element, "obrowser:expand:finished");
			}
		},

		_lockExpandTool: function (element) {
			var expandTool = element.down('.expand-tool');
			if (expandTool) {
				expandTool.addClassName('locked');
			}
		},

		_unlockExpandTool: function (element) {
			var expandTool = element.down('.expand-tool');
			if (expandTool) {
				expandTool.removeClassName('locked');
			}
		},

		_isExpandToolLocked: function (element) {
			if (element.down('.expand-tool.locked')) {
				return true;
			}
			return false;
		},

		_getExpandCollapseSymbol: function (isCollapsed) {
			if (isCollapsed) {
				return "&#x25ba;";
			}
			return "&#x25bc;";
		},
		_toggleEntrySelection: function (event) {
			var trigger = event.element();
			if (!trigger.hasClassName('select-tool')) {
				trigger.up('.entry').down('input').click();
				return;
			}
			var elt = trigger.up('.entry');
			if (trigger.checked) {
				this._selectEntry(elt);
			} else {
				this._unselectEntry(elt);
			}
		},
		_selectEntry: function (entry) {
			if (this.suggest) {
				if (this.options.modal && typeof (this.container.getPositionInViewport) == 'function') {
					var prevPosition = this.container.getPositionInViewport();
				}
				var value = entry.down('.value').firstChild.nodeValue;
				this.suggest.acceptEntry({'id': entry.__termId, 'value': value, 'category': entry.__termCategory, 'negative': entry.down('.selected.no')}, value, '', true);
				entry.addClassName('accepted');
				if (prevPosition && (typeof (this.container.positionDialogInViewport) == 'function')) {
					this.container.positionDialogInViewport(prevPosition.left, prevPosition.top);
				}
				entry.fire('obrowser:entry:selected', {selected: (entry.down('.selected.no')) ? "no" : "yes"});
			}
		},
		_unselectEntry: function (entry) {
			this.options.unselectTerm(entry.__termId);
			this.options.unselectTerm(entry.__termId, true);
			entry.removeClassName('accepted');
		},

		_browseEntry: function (event) {
			event.stop();
			var elt = event.element().up('.entry');
			this.load(elt.__termId);
		},

		_createParentBranch: function (parent) {
			var parent = this._createBranch('li', 'parent', parent, false);
			return parent;
		},

		_createRoot: function (data) {
			var root = this._createBranch('div', 'root', data, true);
			if (!this.options.showRoot) {
				root.addClassName('no-root');
				root.down('.entry-data').addClassName('invisible');
			}
			return root;
		},

		_createDescendentBranch: function (data) {
			return this._createBranch('li', 'descendent', data, true);
		},

		_isRootEntry: function (element) {
			return element.hasClassName('entry') && element.hasClassName('root');
		},

		setContent: function (content) {
			this.container.setContent(new Element('div', {'class': 'ontology-tree'}).update(content));
		},

		show: function (id) {
			if (id) {
				this.container.show();
				if (this.__crtRoot != id) {
					this.load(id);
				} else {
					Event.fire(this.container.contentContainer || document, 'obrowser:expand:finished');
				}
			}
		},

		hide: function () {
			this.container.close();
		}
	});

	return PhenoTips;
}(PhenoTips || {}));


var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.DropDown = Class.create({
		options: {},
		initialize: function (element) {
			this.element = element;
			this.hasForceOpen = false;
			var existingDropdown = element.next(".dropdown");
			if (existingDropdown) {
				this.contentContainer = null;
				this.dropdown = existingDropdown;
				this.hasForceOpen = true;
			} else {
				this.dropdown = new Element('div', {'class': 'dropdown'});

				this.contentContainer = new Element('div');
				this.dropdown.update(this.contentContainer);
			}
			//var closeButton = new Element('div', {'class': 'close', 'title': 'Close'}).update("&#215;");
			//closeButton.observe("click", this.close.bindAsEventListener(this));
			//this.dropdown.insert({top: closeButton});
		},
		setContent: function (content) {
			this.contentContainer != null ? this.contentContainer.update(content) : null;
		},
		show: function (force) {
			if (force && !this.hasForceOpen) {
				return false;
			}
			if (this.dropdown.hasClassName('invisible')) {
				this.dropdown.removeClassName('invisible');
			} else {
				this.element.insert({after: this.dropdown});
			}
			return true;
		},
		close: function (force) {
			if (force && !this.hasForceOpen) {
				return false;
			}
			this.dropdown.addClassName('invisible');
			return true;
			//this.dropdown.remove();
		}
	});
	return PhenoTips;
}(PhenoTips || {}));


StickyBox = Class.create({
	options: {
		offsetTop: 6,
		offsetBottom: 0,
		resize: false,
		isSticky: function (element) {
			return true
		}
	},
	initialize: function (stickyElement, stickyAreaElement, options) {
		this.stickyElement = stickyElement;
		this.stickyAreaElement = stickyAreaElement;
		if (this.stickyElement && this.stickyAreaElement) {
			this.options = Object.extend(Object.clone(this.options), options || { });
			// Temporary, for backwards compatibility with deprecated parameter 'shadowSize'
			if (this.options.shadowSize && options.offsetTop === undefined) {
				this.options.offsetTop = this.options.shadowSize;
			}
			this.resetPosition = this.resetPosition.bindAsEventListener(this);
			Event.observe(window, 'scroll', this.resetPosition);
			Event.observe(window, 'resize', this.resetPosition);
			if (typeof(this.options.makeDefault) == 'function') {
				thid.makeDefault = this.options.makeDefault.bind(this);
			}
			this.resetPosition();
		}
	},

	resetPosition: function () {
		if (!this.options.isSticky(this.stickyElement) || this.stickyElement.getHeight() >= this.stickyAreaElement.getHeight()) {
			return;
		}
		this.stickyElement.style.height = '';
		this.stickyElement.style.overflow = '';
		this.stickyElement.fire('size:changed');
		this.boxHeight = this.stickyElement.getHeight();
		var maxBoxHeight = document.viewport.getHeight() - this.options.offsetTop - this.options.offsetBottom;
		if (this.options.resize) {
			var memo = {'diff': (maxBoxHeight - this.boxHeight), 'original': this.boxHeight};
			this.boxHeight = maxBoxHeight;
			this.stickyElement.style.height = this.boxHeight + "px";
			this.stickyElement.style.overflow = 'auto';
			this.stickyElement.fire('size:changed', memo);
		}
		this.boxWidth = this.stickyElement.getWidth();
		this.boxMinTop = this.stickyAreaElement.cumulativeOffset().top + this.options.offsetTop;
		this.boxMaxTop = this.stickyAreaElement.cumulativeOffset().top + this.stickyAreaElement.getHeight() - this.boxHeight;
		this.boxLeft = this.stickyElement.cumulativeOffset().left;
		this.boxRelativeLeft = this.boxLeft - this.stickyElement.getOffsetParent().viewportOffset().left;
		var relativeContentPosition = this.stickyAreaElement.viewportOffset().top;
		this.direction = 0;
		if (this.stickyAreaElement._prevPosition) {
			if (this.stickyAreaElement._prevPosition > relativeContentPosition) {
				this.direction = 1;
			} else if (this.stickyAreaElement._prevPosition < relativeContentPosition) {
				this.direction = -1;
			}
		}
		if ((this.options.isSticky(this.stickyElement) || this.direction == 1) &&
			document.viewport.getScrollOffsets().top >= this.boxMinTop &&
			document.viewport.getScrollOffsets().top < this.boxMaxTop) {
			this.makeFixed();
		} else if ((this.options.isSticky(this.stickyElement) || this.direction == -1) &&
			document.viewport.getScrollOffsets().top >= this.boxMaxTop) {
			this.makeAbsolute();
		} else {
			this.makeDefault();
		}
		this.stickyAreaElement._prevPosition = relativeContentPosition;
	},

	makeFixed: function () {
		if (this.stickyElement.style.position != 'fixed') {
			this.stickyElement.addClassName('sticky');
			this.stickyElement.style.left = this.boxLeft + 'px';
			this.stickyElement.style.width = (this.boxWidth) + 'px';
			this.stickyElement.style.top = this.options.offsetTop + 'px';
			this.stickyElement.style.right = '';
			this.stickyElement.style.position = 'fixed';
		}
	},
	makeAbsolute: function (top) {
		if (this.stickyElement.style.position != 'absolute') { // || top && this.stickyElement.style.top != top + 'px'){
			this.stickyElement.addClassName('sticky');
			top = top || (this.stickyAreaElement.getHeight() - this.stickyElement.getHeight());
			this.stickyElement.style.top = top + 'px';
			this.stickyElement.style.right = '';
			var originalPosition = this.stickyElement.getStyle('position');
			this.stickyElement.style.position = 'absolute';
			if (originalPosition == 'fixed' && !Prototype.Browser.WebKit) {
				this.stickyElement.style.left = (this.boxRelativeLeft - this.stickyElement.getOffsetParent().viewportOffset().left + 2) + 'px';
			} else {
				this.stickyElement.style.left = this.boxRelativeLeft + 'px';
			}
		}
	},
	makeDefault: function () {
		if (this.stickyElement.style.position != '') {
			this.stickyElement.removeClassName('sticky');
			this.stickyElement.style.position = '';
			this.stickyElement.style.top = '';
			this.stickyElement.style.left = '';
			this.stickyElement.style.right = '';
			this.stickyElement.style.width = '';
		}
	},
	isFixed: function () {
		return (this.stickyElement.style.position == 'fixed');
	},
	isAbsolute: function () {
		return (this.stickyElement.style.position == 'absolute');
	},
	isDefault: function () {
		return (this.stickyElement.style.position == '');
	}
});

var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.FreeMultiselect = Class.create({
		counter: 1,
		options: {
			returnKeyNavigation: false
		},
		initialize: function (element, options) {
			this.options = Object.extend(Object.clone(this.options), options || { });
			var _this = this;

			// Suggest?
			var suggestInfoSource = element.previous('input[name="xwiki-free-multiselect-suggest-script"][type="hidden"]');
			if (suggestInfoSource && suggestInfoSource.value && typeof(XWiki.widgets.Suggest) != "undefined") {
				this.suggestOptions = {
					script: suggestInfoSource.value,
					shownoresults: false,
					varname: "input",
					timeout: 0
				}
			}

			// Add a delete button and a "KEY_RETURN" keypress event listener for each line
			this.enhanceLine = this.enhanceLine.bind(this);
			var values = element.select('li input.xwiki-free-multiselect-value');
			values.each(this.enhanceLine);

			// Generate and insert the "add" button, edit mode only
			if (element.down('input.xwiki-free-multiselect-value')) {
				var addTool = new Element('a', {'title': 'add', 'href': '#' + element.id}).update('+...');
				element.insert(addTool.wrap('li'));
				addTool.observe('click', function (event) {
					event.stop();
					var prevLine = addTool.up('li').previous();
					var template = prevLine && prevLine.down('input.xwiki-free-multiselect-value');
					if (template) {
						_this.generateInput(template);
					}
				}.bindAsEventListener(this));
			}
		},

		enhanceLine: function (element) {
			element.id = this.generateId(element);
			element.up('li').addClassName('xwiki-free-multiselect-line');
			this.attachDeleteTool(element);
			if (this.suggestOptions) {
				new XWiki.widgets.Suggest(element, this.suggestOptions);
			}
			this.enableAddInput(element);
		},

		attachDeleteTool: function (element) {
			var wrapper = element.up('.xwiki-free-multiselect-line');
			var deleteTool = new Element('a', {'title': 'delete', 'href': '#' + element.id}).update('✖');
			wrapper.insert(' ').insert(deleteTool);
			deleteTool.observe('click', function (event) {
				event.stop();
				var wrapper = event.findElement('.xwiki-free-multiselect-line');
				if (wrapper.previous('.xwiki-free-multiselect-line') || wrapper.next('.xwiki-free-multiselect-line')) {
					wrapper.remove();
				} else {
					var target = wrapper.down('input');
					target.value = '';
					target.focus();
				}
			});
		},

		enableAddInput: function (element) {
			var wrapper = element.up('.xwiki-free-multiselect-line');
			var _this = this;
			if (!wrapper) {
				return;
			}
			element.observe('keypress', function (event) {
				if (event.keyCode == Event.KEY_RETURN) {
					event.stop();
					var next = wrapper.next('.xwiki-free-multiselect-line');
					if (_this.options.returnKeyNavigation && next && next.down('input')) {
						next.down('input').focus();
					} else {
						element.next().removeClassName('inactive');
						_this.generateInput(element);
					}
				} else if (event.keyCode == Event.KEY_BACKSPACE && element.value == '') {
					event.stop();
					var previous = wrapper.previous('.xwiki-free-multiselect-line');
					if (previous && previous.down('input')) {
						previous.down('input').focus();
						element.up('.xwiki-free-multiselect-line').remove();
					}
				}
			});
		},

		generateInput: function (template) {
			var newInput = new Element('input', {'name': template.name, id: this.generateId(template), type: template.type, size: template.size, 'class': 'xwiki-free-multiselect-value'});
			var newWrapper = new Element('li');
			newWrapper.insert(newInput);
			template.up('.xwiki-free-multiselect-line').insert({after: newWrapper});
			this.enhanceLine(newInput);
			newInput.focus();
		},

		generateId: function (element) {
			return element.name + '_' + this.nextIndex();
		},

		nextIndex: function () {
			return ++this.counter;
		},

		lastIndex: function () {
			return this.counter;
		}

	});
	return PhenoTips;
}(PhenoTips || {}));

document.observe("xwiki:dom:loaded", function () {
	$$('.xwiki-free-multiselect').each(function (element) {
		new PhenoTips.widgets.FreeMultiselect(element);
	});
});


var XWiki = (function (XWiki) {
	// Start XWiki augmentation
	var widgets = XWiki.widgets = XWiki.widgets || {};

	widgets.VisibilityController = Class.create({
		initialize: function (element) {
			this.element = element;
			this.reverse = this.element.hasClassName("exclude");
			this.controller = this.element.select(".controller input[type=checkbox]");
			var eventName = "change";
			if (this.controller.length == 0) {
				return;
			} else if (this.controller.length == 1) {
				this.controller = this.controller[0];
			} else {
				this.controller = this.element.down(".controller .yes input[type=checkbox]");
				eventName = "picker:change";
			}
			if (!this.controller) {
				// No controller, nothing else to do...
				return;
			}
			this.controlled = this.element.select(".controlled");
			if (this.element.hasClassName("complete-hide")) {
				this.hiddenStyle = {"display": "none"};
				this.visibleStyle = {"display": ""};
			} else {
				this.hiddenStyle = {"visibility": "hidden"};
				this.visibleStyle = {"visibility": "visible"};
			}
			this.controlVisibility();
			this.controller.observe(eventName, this.controlVisibility.bindAsEventListener(this));
		},
		controlVisibility: function () {
			if (this.controller.checked ^ this.reverse) {
				this.controlled.invoke("setStyle", this.hiddenStyle);
				this.element.select(".controlled input").invoke("disable");
			} else {
				this.controlled.invoke("setStyle", this.visibleStyle);
				this.element.select(".controlled input").invoke("enable");
			}
		}
	});

	var init = function (event) {
		((event && event.memo.elements) || [$('body')]).each(function (element) {
			element.select(".controlled-group").each(function (group) {
				if (!group.__visibilityController) {
					group.__visibilityController = new XWiki.widgets.VisibilityController(group);
				}
			});
		});
		return true;
	};

	(XWiki.domIsLoaded && init()) || document.observe("xwiki:dom:loaded", init);
	document.observe("xwiki:dom:updated", init);

	// End XWiki augmentation.
	return XWiki;
}(XWiki || {}));


var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.UnitConverter = Class.create({

		CONVERSION_META: {
			'weight': {
				'imperial_units': ['lb', 'oz'],
				'metric_unit': 'kg',
				'inter_unit_scale': 16,
				'inter_system_scale': 0.0283495
			},
			'length': {
				'imperial_units': ['ft', 'in'],
				'metric_unit': 'cm',
				'inter_unit_scale': 12,
				'inter_system_scale': 2.54
			}
		},

		DEFAULT_UNIT_SYSTEM: 'metric',

		initialize: function (container, selector, triggerInsertionElt, triggerInsertionPosition, system) {
			this._selector = selector;
			this._container = container || document.documentElement;
			if (!this._selector || !triggerInsertionElt) {
				return;
			}

			this.crtUnitSystem = system || this.DEFAULT_UNIT_SYSTEM;

			this.initializeElements = this.initializeElements.bind(this);
			this.attachConverter = this.attachConverter.bind(this);

			this.generateTrigger(triggerInsertionElt, triggerInsertionPosition || 'bottom');

			this.initializeElements();
			var _this = this;
			document.observe('xwiki:dom:updated', function (event) {
				if (event.memo && event.memo.elements) {
					event.memo.elements.each(_this.initializeElements.bind(_this));
				}
			});
		},

		generateTrigger: function (atElement, position) {
			this._trigger = new Element('select', {"class": "unit-system-selector"});

			var optionMetric = new Element('option', {
				value: 'metric'
			}).update('Metric units (' + this.CONVERSION_META.weight.metric_unit + ', ' + this.CONVERSION_META.length.metric_unit + ')');
			if (this.crtUnitSystem == 'metric') {
				optionMetric.selected = 'selected';
			}
			var optionImperial = new Element('option', {
				value: 'imperial'
			}).update('Imperial units (' + this.CONVERSION_META.weight.imperial_units.join(' / ') + ', ' + this.CONVERSION_META.length.imperial_units.join(' / ') + ')');
			if (this.crtUnitSystem == 'imperial') {
				optionImperial.selected = 'selected';
			}
			this._trigger.insert(optionMetric).insert(optionImperial);

			insertionInfo = {};
			insertionInfo[position] = this._trigger;
			atElement.insert(insertionInfo);

			var _this = this;
			this._trigger.observe('change', function (event) {
				_this.crtUnitSystem = _this._trigger.options[_this._trigger.selectedIndex].value;
				_this.switchUnits(_this.crtUnitSystem);
			});
		},

		initializeElements: function (element) {
			container = element || this._container;
			if (container.__unitSwitcher || (!container.up('.measurements') && !container.hasClassName('measurements'))) {
				return;
			}
			container.__unitSwitcher = this;
			container.select(this._selector).each(this.attachConverter);
			this.switchUnits(this.crtUnitSystem, container);
		},

		switchUnits: function (type, element) {
			container = element || this._container;
			container.select('.unit-conversion-values .unit-type').each(function (item) {
				if (item.hasClassName(type)) {
					item.show();
				} else {
					item.hide();
				}
			});
		},

		attachConverter: function (element) {
			if (element.tagName.toLowerCase() != 'input' || element.type != 'text') {
				return;
			}
			var unitElt = element.next('.unit');
			var converterElement = new Element('div', {'class': 'unit-conversion-values'});
			var imperialUnits;
			var type = (element.up('.weight')) ? 'weight' : 'length';

			converterElement.addClassName(type);
			converterElement._meta = this.CONVERSION_META[type];

			var values = this.metricToImperial(converterElement._meta, parseFloat(element.value) || 0);

			var metricZone = element.up('.metric');
			if (!metricZone) {
				metricZone = new Element('div', {'class': 'unit-type metric'});
				metricZone.insert(element).insert(unitElt || converterElement._meta.metric_unit);
				element.insert({after: converterElement});
			} else {
				metricZone.addClassName('unit-type');
				metricZone.insert({after: converterElement});
			}
			var imperialZone = new Element('div', {'class': 'unit-type imperial'});
			converterElement.insert(metricZone).insert(imperialZone);

			converterElement._meta.imperial_units.each(function (unit) {
				imperialZone.insert(new Element('label').insert(new Element('input', {'style': 'width: auto', 'name': unit, type: 'text', size: 3, value: (values[unit] || '')})).insert(unit));
			});

			this.enableSyncValues(converterElement);
		},

		enableSyncValues: function (element) {
			var _this = this;
			element.select('.imperial input').invoke('observe', 'change', function (event) {
				_this.syncMetricWithImperial(element);
			});
			element.select('.metric input').invoke('observe', 'change', function (event) {
				_this.syncImperialWithMetric(element);
			});
		},

		syncMetricWithImperial: function (element) {
			var metricInput = element.down('.metric input');
			metricInput.value = this.imperialToMetric(element._meta,
					parseFloat(element.down('.imperial input[name="' + element._meta.imperial_units[0] + '"]').value) || 0,
					parseFloat(element.down('.imperial input[name="' + element._meta.imperial_units[1] + '"]').value) || 0
			) || '';
			Event.fire(metricInput, 'phenotips:measurement-updated');
		},

		syncImperialWithMetric: function (element) {
			var imperialValues = this.metricToImperial(element._meta, parseFloat(element.down('.metric input').value) || 0);
			element._meta.imperial_units.each(function (unit) {
				element.down('.imperial input[name="' + unit + '"]').value = imperialValues[unit] || '';
			});
		},

		metricToImperial: function (conversionMeta, value) {
			var result = {};
			var lowerUnitValue = value / conversionMeta.inter_system_scale;
			var higherUnitValue = Math.floor(lowerUnitValue / conversionMeta.inter_unit_scale);
			lowerUnitValue = lowerUnitValue - higherUnitValue * conversionMeta.inter_unit_scale;
			if (lowerUnitValue) {
				lowerUnitValue = lowerUnitValue.toFixed(2);
			}
			result[conversionMeta.imperial_units[0]] = higherUnitValue;
			result[conversionMeta.imperial_units[1]] = lowerUnitValue;
			return result;
		},

		imperialToMetric: function (conversionMeta, higherUnitValue, lowerUnitValue) {
			return ((conversionMeta.inter_unit_scale * higherUnitValue + lowerUnitValue) * conversionMeta.inter_system_scale).toFixed(2);
		}
	});
	return PhenoTips;
}(PhenoTips || {}));


PhenoTips = (function (PhenoTips) {
	// Start augmentation
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};

	widgets.HelpButton = Class.create({

		infoServices: {
			'xHelpButton': {
				'hint': $services.localization.render('phenotips.widgets.helpButtons.xHelpButton.hint'),
				'callback': function (helpButton) {
					helpButton.helpBox.content.update(helpButton._information || '');
				}
			},
			'phenotype-info': {
				'hint': $services.localization.render('phenotips.widgets.helpButtons.phenotype.hint'),
				'service': "$xwiki.getURL('PhenoTips.PhenotypeInfoService', 'get')",
				'callback': function (helpButton, json) {
					var c = helpButton.helpBox.content;
					var elt = function (type, cssClass, content) {
						return new Element(type, cssClass && {'class': cssClass} || {}).update(content || '');
					};

					c.update(
						elt('span', 'info').insert(elt('span', 'key').update(json.id))
							.insert(' ')
							.insert(elt('span', 'value').update(json.label))
					);
					json.def && c.insert(elt('p').update(json.def.replace(/\s*\n\s*/, ' ').replace(/`([^`]+)`\s+\(([A-Z]+:[0-9]+)`?\)/g, '<em title="$2">$1</em>')));

					var labels = {'synonym': $services.localization.render('phenotips.widgets.helpButtons.phenotype.synonym'), 'is_a': $services.localization.render('phenotips.widgets.helpButtons.phenotype.typeOf')};
					var advancedInfo = elt('dl');
					for (var l in labels) {
						if (json[l]) {
							advancedInfo.insert(elt('dt', '', labels[l]));
							json[l].each(function (item) {
								advancedInfo.insert(elt('dd', '', item.label || item));
							})
						}
					}
					if (advancedInfo.firstDescendant()) {
						c.insert(advancedInfo);
					}

					if (PhenoTips.widgets.OntologyBrowser) {
						var browseButton = new Element('a', {'class': 'button', href: '#'}).update($services.localization.render('phenotips.widgets.helpButtons.phenotype.browseRelated'));
						browseButton._id = json.id;
						browseButton.observe('click', function (event) {
							event.stop();
							var suggest = ($('quick-phenotype-search') || $$('input.suggestHpo')[0])._suggest;
							var params = {};
							if (typeof isPhenotypeSelected !== 'undefined') {
								params = {
									isTermSelected: isPhenotypeSelected,
									unselectTerm: unselectPhenotype
								};
							}
							browseButton._obrowser = new PhenoTips.widgets.OntologyBrowser(suggest, null, params);
							browseButton._obrowser.show(browseButton._id);
						});
						c.insert(elt('div', 'term-tools').insert(browseButton.wrap('span', {'class': 'buttonwrapper'})));
					}
				}
			},
			'phenotype-qualifier-info': {
				'hint': $services.localization.render('phenotips.widgets.helpButtons.phenotypeQualifier.hint'),
				'service': "$xwiki.getURL('PhenoTips.PhenotypeInfoService', 'get')",
				'callback': function (helpButton, json) {
					var c = helpButton.helpBox.content;
					var elt = function (type, cssClass, content) {
						return new Element(type, cssClass && {'class': cssClass} || {}).update(content || '');
					};
					c.update(
						elt('span', 'info').insert(elt('span', 'key').update(json.id))
							.insert(' ')
							.insert(elt('span', 'value').update(json.label))
					);
					json.def && c.insert(elt('p').update(json.def.replace(/\s*\n\s*/, ' ').replace(/`([^`]+)`\s+\(([A-Z]+:[0-9]+)`?\)/g, '<em title="$2">$1</em>')));
				}
			},
			'omim-disease-info': {
				'hint': "About this disease",
				'service': "$xwiki.getURL('PhenoTips.OmimInfoService', 'get')",
				'callback': function (helpButton, json) {
					var c = helpButton.helpBox.content;
					var elt = function (type, cssClass, content) {
						return new Element(type, cssClass && {'class': cssClass} || {}).update(content || '');
					};

					c.update(
						elt('span', 'info').insert(elt('span', 'key').update(json.id))
							.insert(' ')
							.insert(elt('span', 'value').update(json.label.splice(0, 1)[0]))
					);

					var labels = {'label': '', 'symptoms': $services.localization.render('phenotips.widgets.helpButtons.omimDisease.symptoms'), 'not_symptoms': $services.localization.render('phenotips.widgets.helpButtons.omimDisease.notSymptoms')};
					var advancedInfo = elt('dl');
					for (var l in labels) {
						if (json[l] && json[l].length > 0) {
							advancedInfo.insert(elt('dt', '', labels[l]));
							json[l].each(function (item) {
								advancedInfo.insert(elt('dd', '', item.label || item));
							})
						}
					}
					if (advancedInfo.firstDescendant()) {
						c.insert(advancedInfo);
					}
					var viewButton = new Element('a', {'class': 'button', href: 'http://www.omim.org/entry/' + json.id, 'target': '_blank'}).update($services.localization.render('phenotips.widgets.helpButtons.omimDisease.linkToOmim'));
					c.insert(elt('div', 'term-tools').insert(viewButton.wrap('span', {'class': 'buttonwrapper'})));
					viewButton.observe('click', function (event) {
						event.stop();
						window.open(viewButton.href);
					});
					if (json.gene_reviews_link) {
						var geneReviewsButton = new Element('a', {'class': 'button', href: json.gene_reviews_link, 'target': '_blank'}).update('Read about it on Gene Reviews...');
						c.insert(elt('div', 'term-tools').insert(geneReviewsButton.wrap('span', {'class': 'buttonwrapper'})));
						geneReviewsButton.observe('click', function (event) {
							event.stop();
							window.open(geneReviewsButton.href);
						});
					}
				}
			},
			'gene-info': {
				'hint': $services.localization.render('phenotips.widgets.helpButtons.gene.hint'),
				'service': "$xwiki.getURL('PhenoTips.GeneInfoService', 'get')",
				'callback': function (helpButton, json) {
					var c = helpButton.helpBox.content;
					var elt = function (type, cssClass, content) {
						return new Element(type, cssClass && {'class': cssClass} || {}).update(content || '');
					};

					c.update(
						elt('span', 'info').insert(elt('span', 'key').update(json.symbol))
							.insert(' ')
							.insert(elt('span', 'value').update(json.name))
					);

					var labels = {'alias_symbol': $services.localization.render('phenotips.widgets.helpButtons.gene.alias'), 'prev_symbol': $services.localization.render('phenotips.widgets.helpButtons.gene.previousSymbols'), 'gene_family': $services.localization.render('phenotips.widgets.helpButtons.gene.family')};
					var advancedInfo = elt('dl');
					for (var l in labels) {
						if (json[l] && json[l].length > 0) {
							advancedInfo.insert(elt('dt', '', labels[l]));
							if (Object.prototype.toString.call(json[l]) === '[object Array]') {
								json[l].each(function (item) {
									advancedInfo.insert(elt('dd', '', item.label || item));
								})
							} else {
								advancedInfo.insert(elt('dd', '', json[l]));
							}
						}
					}
					if (advancedInfo.firstDescendant()) {
						c.insert(advancedInfo);
					}

					if (json.external_ids) {
						var tools = elt('div', 'term-tools');
						var externalDBs = [
							{ name: 'GENECARDS', url: 'http://www.genecards.org/cgi-bin/carddisp.pl?gene=', field: 'genecards_id'},
							{ name: 'OMIM', url: 'http://www.omim.org/entry/', field: 'omim_id'},
							{ name: 'Entrez', url: 'http://www.ncbi.nlm.nih.gov/gene/?term=', field: 'entrez_id'},
							{ name: 'RefSeq', url: 'http://www.ncbi.nlm.nih.gov/nuccore/', field: 'refseq_accession'},
							{ name: 'Ensembl', url: 'http://useast.ensembl.org/Homo_sapiens/Gene/Compara_Tree?g=', field: 'ensembl_gene_id'}
						];
						externalDBs.each(function (item) {
							var value = json.external_ids[item.field];
							if (value) {
								if (!value.each) {
									value = [value];
								}
								value.each(function (id) {
									tools.insert(new Element('a', {
										'href': item.url + id,
										'class': 'button'
									}).update(item.name + ': ' + id).wrap('span', {'class': 'buttonwrapper'}));
								});
							}
						});
						// We must stop the event, otherwise this item will be selected; as a consequence, we must also manually open the link
						tools.select('a').each(function (item) {
							item.observe('click', function (event) {
								event.stop();
								window.open(item.href);
							})
						});
						c.insert(tools);
					}
				}
			}
		},

		initialize: function (icon) {
			this.icon = icon;
			this._information = this.icon._information || this.icon.title;
			for (var label in this.infoServices) {
				if (this.icon.hasClassName(label)) {
					this._builder = this.infoServices[label];
					this.icon.title = this.infoServices[label].hint || '';
				}
			}
			if (!this._builder) {
				return;
			}
			this.icon.observe("click", this.toggleHelp.bindAsEventListener(this));
			this.hideAllHelpOnOutsideClick = this.hideAllHelpOnOutsideClick.bindAsEventListener(this);
		},

		toggleHelp: function () {
			if (!this.helpBox || this.helpBox.hasClassName('hidden')) {
				this.showHelp();
				document.observe('click', this.hideAllHelpOnOutsideClick);
			} else {
				this.hideHelp();
			}
		},

		hideAllHelpOnOutsideClick: function (event) {
			if (!event.findElement('.xTooltip') && !event.findElement('.xHelpButton')) {
				this.hideHelp();
				document.stopObserving('click', this.hideAllHelpOnOutsideClick);
			}
		},

		hideHelp: function (event) {
			event && event.stop();
			if (this.helpBox) {
				if (this.helpBox.hasClassName('error')) {
					this.helpBox.remove();
					delete this.helpBox;
				} else {
					this.helpBox.addClassName('hidden');
				}
			}
		},

		showHelp: function () {
			if (!this.helpBox) {
				this.createHelpBox();
			}
			$$('div.xTooltip:not(.hidden)').invoke('_hideHelp');
			this.helpBox.removeClassName('hidden');
		},

		createHelpBox: function () {
			this.helpBox = new Element('div', {'class': 'hidden xTooltip'});
			this.helpBox._behavior = this;
			this.helpBox._hideHelp = function () {
				this._behavior.hideHelp();
			}.bind(this.helpBox);

			this.helpBox.content = new Element('div');
			this.helpBox.insert(this.helpBox.content);

			if (this._builder.service) {
				this.createHelpContentFromService();
			} else {
				this._builder.callback && this._builder.callback(this);
			}

			var closeButton = new Element('span', {'class': 'hide-tool', 'title': 'Hide'});
			closeButton.update('×');
			closeButton.observe('click', this.hideHelp.bindAsEventListener(this));
			this.helpBox.insert({'top': closeButton});
			this.icon.insert({'after': this.helpBox});
		},

		createHelpContentFromService: function () {
			var _this = this;
			new Ajax.Request(_this._builder.service, {
				parameters: {'id': _this._information},
				onCreate: function () {
					_this.helpBox.content.update(new Element('span', {'class': 'hint temporary'}).update($services.localization.render('phenotips.widgets.helpButtons.loading')));
				},
				onSuccess: function (response) {
					_this._builder.callback(_this, response.responseJSON);
				},
				onFailure: function (response) {
					_this.helpBox.addClassName('error');
					_this.helpBox.down('.temporary').remove();
					_this.helpBox.insert($services.localization.render('phenotips.widgets.helpButtons.failedToLoad').replace("__subject__", _this._information) + " : " + response.statusText);
				}
			});
		}
	});

	var init = function (event) {
		((event && event.memo.elements) || [$('body')]).each(function (element) {
			(element.hasClassName("xHelpButton") ? [element] : element.select(".xHelpButton")).each(function (icon) {
				if (!icon.__helpController) {
					icon.__helpController = new PhenoTips.widgets.HelpButton(icon);
				}
			});
		});
		return true;
	};

	(XWiki.domIsLoaded && init()) || document.observe("xwiki:dom:loaded", init);
	document.observe("xwiki:dom:updated", init);

	// End augmentation.
	return PhenoTips;
}(PhenoTips || {}));

var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};

	widgets.FuzzyDatePickerDropdown = Class.create({
		initialize: function (options) {
			this.span = new Element('span');
			this.options = options;
			this.callback = null;
		},

		populate: function (values) {
			var selectedIndex = this.dropdown ? (this.dropdown.selectedIndex || this._tmpSelectedIndex) : 0;

			// using raw HTML for performance reasons: generating many years takes a noticeable time using
			// more proper methods (e.g. new Element()...)
			// (Note: using span around select because IE9 does not allow setting innerHTML of <select>-s)
			var optionsHTML = '<select name="' + this.options.name +
				'" class="' + (this.options.cssClass || this.options.name || '') +
				'" placeholder="' + (this.options.hint || this.options.name || '') +
				'" title="' + (this.options.hint || this.options.name || '') + '">';

			optionsHTML += '<option value="" class="empty"> </option>';
			values.each(function (item) {
				optionsHTML += '<option value="' + item.value + '"';
				if (item.cssClass) {
					optionsHTML += ' class="' + item.cssClass + '"';
				}
				if (item.selected) {
					optionsHTML += ' selected="selected"';
				}
				optionsHTML += '>' + (item.text || item.value || '') + '</option>';
			});
			optionsHTML += "</select>";
			this.span.innerHTML = optionsHTML;
			this.dropdown = this.span.firstChild;
			this.callback && this.onSelect(this.callback);
			if (this.dropdown.selectedIndex <= 0 && selectedIndex >= 0 && selectedIndex < this.dropdown.options.length) {
				this.dropdown.selectedIndex = selectedIndex;
			}
		},

		enable: function () {
			this.dropdown.enable();
			if (this.dropdown.selectedIndex <= 0 && this._tmpSelectedIndex < this.dropdown.options.length) {
				this.dropdown.selectedIndex = this._tmpSelectedIndex;
				return (this._tmpSelectedIndex > 0);
			}
			return false;
		},

		disable: function () {
			this.dropdown.disable();
			this._tmpSelectedIndex = this.dropdown.selectedIndex;
			this.dropdown.selectedIndex = 0;
		},

		getElement: function () {
			return this.span;
		},

		onSelect: function (callback) {
			var _this = this;
			this.callback = callback;
			var events = ['change'];
			browser.isGecko && events.push('keyup');
			events.each(function (eventName) {
				_this.dropdown.observe(eventName, function () {
					callback();
					_this._tmpSelectedIndex = _this.dropdown.selectedIndex;
				});
			});
		},

		onFocus: function (callback) {
			var _this = this;
			this.dropdown.observe('focus', function () {
				callback();
				if (_this.dropdown.selectedIndex == -1 && _this._tmpSelectedIndex < _this.dropdown.options.size()) {
					_this.dropdown.selectedIndex = _this._tmpSelectedIndex;
				}
			});
		},
		onBlur: function (callback) {
			this.dropdown.observe('blur', callback);
		},

		getSelectedValue: function () {
			return (this.dropdown.selectedIndex >= 0) ? this.dropdown.options[this.dropdown.selectedIndex].value : '';
		},

		getSelectedOption: function () {
			return (this.dropdown.selectedIndex >= 0) ? this.dropdown.options[this.dropdown.selectedIndex].innerHTML : '';
		}
	});

	widgets.FuzzyDatePicker = Class.create({
		initialize: function (input) {
			if (!input) {
				return
			}
			;
			this.__input = input;
			this.__input.hide();
			this.__fuzzyInput = $(this.__input.name + '_entered')
			if (this.__fuzzyInput) {
				this.__recordBoth = true;
			}
			if (this.__fuzzyInput && this.__fuzzyInput.value) {
				this.__date = JSON.parse(this.__fuzzyInput.value || '{}');
			} else if (this.__input.alt) {
				var parsedDate = new Date(this.__input.alt);
				this.__date = {'year': parsedDate.getUTCFullYear(), 'month': parsedDate.getUTCMonth() + 1, 'day': parsedDate.getUTCDate()};
			} else {
				this.__date = {};
			}

			this.container = new Element('div', {'class': 'fuzzy-date-picker'});

			//Insertion is done before, so that validation errors can appear after it
			this.__input.insert({before: this.container});
			var format = (this.__input.title || 'yyyy-MM-dd').split(/\W+/);
			for (var i = 0; i < format.length; ++i) {
				switch (format[i][0]) {
					case 'y':
						this.container.insert(this.createYearDropdown());
						break;
					case 'M':
						this.container.insert(this.createMonthDropdown());
						break;
					case 'd':
						this.container.insert(this.createDayDropdown());
						break;
				}
			}

			// TODO: yearSelector's (and month's & day's) .onSelect() does not seem to fire
			//       upon programmatic update if a substitute is found can remove these hackish events
			this.container.observe("datepicker:date:changed", this.onProgrammaticUpdate.bind(this));
			this.onProgrammaticUpdate();
		},

		onProgrammaticUpdate: function () {
			this.yearSelected();
			this.monthSelected();
			this.updateDate();
		},

		createYearDropdown: function () {
			this.yearSelector = new widgets.FuzzyDatePickerDropdown({name: "year"});

			var today = new Date();
			var crtYear = today.getYear() + 1900;
			var startYear = 1900;

			var values = [];
			for (var y = crtYear; y >= startYear; --y) {
				values.push({"value": y, "selected": this.__date.year == y});
				if (y % 10 == 0) {
					values.push({"value": (y + "s"), "cssClass": "decade", "text": (y + 's'), "selected": this.__date.decade == y + "s"});
				}
			}
			values.push({"value": "1800s", "cssClass": "decade", "selected": this.__date.decade == "1800s"});
			values.push({"value": "1700s", "cssClass": "decade", "selected": this.__date.decade == "1700s"});
			values.push({"value": "1600s", "cssClass": "decade", "selected": this.__date.decade == "1600s"});

			this.yearSelector.populate(values);
			this.yearSelector.onSelect(this.yearSelected.bind(this));

			return this.yearSelector.getElement();
		},

		yearSelected: function () {
			if (!this.yearSelector) {
				return;
			}
			if (this.yearSelector.getSelectedValue() > 0) {
				//  this.monthSelector.enable();
				this.monthSelector && this.monthSelected();
				//} else {
				//  this.monthSelector.disable();
				//  this.daySelector.disable();
			}
			this.updateDate();
		},

		createMonthDropdown: function () {
			this.monthSelector = new widgets.FuzzyDatePickerDropdown({name: "month"});
			this.monthSelector.populate(this.getZeroPaddedValueRange(1, 12, this.__date.month));
			//this.monthSelector.disable();
			this.monthSelector.onSelect(this.monthSelected.bind(this));
			return this.monthSelector.getElement();
		},

		monthSelected: function () {
			if (!this.monthSelector) {
				return;
			}
			if (this.monthSelector.getSelectedValue() > 0) {
				this.daySelector && this.daySelector.populate(this.getAvailableDays());
				//  this.daySelector.enable();
				//} else {
				//  this.daySelector.disable();
			}
			this.updateDate();
		},

		createDayDropdown: function () {
			this.daySelector = new widgets.FuzzyDatePickerDropdown({name: "day"});
			this.daySelector.populate(this.getZeroPaddedValueRange(1, 31, this.__date.day));
			//this.daySelector.disable();
			this.daySelector.onSelect(this.updateDate.bind(this));
			return this.daySelector.getElement();
		},

		getAvailableDays: function () {
			var year = this.yearSelector.getSelectedValue() * 1;
			var month = this.monthSelector.getSelectedValue() * 1;
			var lastDayOfMonth = 0;
			if ([1, 3, 5, 7, 8, 10, 12].indexOf(month) >= 0) {
				lastDayOfMonth = 31;
			} else if ([4, 6, 9, 11].indexOf(month) >= 0) {
				lastDayOfMonth = 30
			} else if (month == 2) {
				if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) {
					lastDayOfMonth = 29;
				} else {
					lastDayOfMonth = 28;
				}
			}
			return this.getZeroPaddedValueRange(1, lastDayOfMonth);
		},

		getZeroPaddedValue: function (value) {
			return value ? ("0" + value).slice(-2) : "01";
		},

		getZeroPaddedValueRange: function (start, end, selected) {
			var values = [];
			if (start <= end) {
				for (var v = start; v <= end; ++v) {
					values.push({'value': v, 'text': ("0" + v).slice(-2), 'selected': selected == v});
				}
			} else {
				for (var v = end; v <= start; --v) {
					values.push({'value': v, 'text': ("0" + v).slice(-2), 'selected': selected == v});
				}
			}
			return values;
		},

		updateDate: function () {
			var dateObject = {};

			var y = this.yearSelector.getSelectedValue();
			if (y.match(/\d\d\d\ds$/)) {
				dateObject["decade"] = y;
			} else {
				if (y != "") {
					dateObject["year"] = y;
				}
			}

			if (y > 0) {
				var m = this.monthSelector && this.monthSelector.getSelectedValue();
				if (m > 0) {
					dateObject["month"] = this.monthSelector.getSelectedOption();

					var d = this.daySelector && this.daySelector.getSelectedValue();
					if (d > 0) {
						dateObject["day"] = this.daySelector.getSelectedOption();
					}
				}
			}

			var newValue = JSON.stringify(dateObject);
			if (this.__recordBoth) {
				var oldValue = this.__fuzzyInput.value;
				if (newValue != oldValue) {
					this.__fuzzyInput.value = JSON.stringify(dateObject);
					this.__input.value = (y && !y.match(/\d\d\d\ds$/)) ? (y + "-" + this.getZeroPaddedValue(m) + "-" + this.getZeroPaddedValue(d)) : "";
					this.__input.alt = (y && !y.match(/\d\d\d\ds$/)) ? (y + "-" + this.getZeroPaddedValue(m) + "-" + this.getZeroPaddedValue(d) + "T00:00:00Z") : "";
					this.__input.fire("xwiki:date:changed");
				}
			} else {
				var oldValue = this.__input.value;
				if (newValue != oldValue) {
					this.__input.value = JSON.stringify(dateObject);
					this.__input.alt = (y && !y.match(/\d\d\d\ds$/)) ? (y + "-" + this.getZeroPaddedValue(m) + "-" + this.getZeroPaddedValue(d) + "T00:00:00Z") : "";
					this.__input.fire("xwiki:date:changed");
				}
			}
		}
	});

	var init = function (event) {
		((event && event.memo.elements) || [$('body')]).each(function (element) {
			(element.hasClassName("fuzzy-date") ? [element] : element.select(".fuzzy-date")).each(function (dateInput) {
				if (!dateInput.__datePicker) {
					dateInput.__datePicker = new PhenoTips.widgets.FuzzyDatePicker(dateInput);
				}
			});
		});
		return true;
	};

	(XWiki.domIsLoaded && init()) || document.observe("xwiki:dom:loaded", init);
	document.observe("xwiki:dom:updated", init);

	// End augmentation.

	return PhenoTips;
}(PhenoTips || {}));

(function () {
	var init = function (event) {
		var containers = (event && event.memo.elements) || [$('body')];
		containers.each(function (container) {
			container.select('input.suggestWorkgroups').each(function (input) {
				if (!input.hasClassName('initialized')) {
					var options = {
						script: new XWiki.Document('SuggestWorkgroupsService', 'PhenoTips').getURL('get', 'outputSyntax=plain&'),
						noresults: $services.localization.render('phenotips.widgets.workgroupPicker.noResults')
					};
					// The picker suggests by default local workgroups.
					if (input.hasClassName('global')) {
						// Suggest global users or groups.
						options.script = options.script + 'wiki=global&';
					}
					new XWiki.widgets.UserPicker(input, options);
					input.addClassName('initialized');
				}
			});
		});
	};
	(XWiki.domIsLoaded && init()) || document.observe('xwiki:dom:loaded', init);
	document.observe('xwiki:dom:updated', init);
})()

var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.SegmentedBar = Class.create({
		options: {
			segments: 5,
			displayValue: true
		},
		/**
		 A PhenoTips widget for displaying a value as a segmented bar HTML element. It uses the current text color and font size, so adjusting the look of the bar means changing the color and font-size on the HTML element returned by the generateSegmentedBar method, or on one of its ancestors, either via a CSS extension or programmatically. Example:

		 var barOptions = {
          segments : 10,
          displayValue : false
        };
		 container.insert(new PhenoTips.widgets.SegmentedBar(score, barOptions).generateSegmentedBar().setStyle({color: 'red', fontSize: '200%'}));

		 @param value The value that this bar is meant to display. Must be between 0 and 1.

		 @param options Options for styling the segmented bar, all values are optional:

		 {
  segments: The number of segments in the bar; default is 5,
  displayValue: Option to display the percentage value after the bar; default is true
}

		 */
		initialize: function (value, options) {
			this.value = value;
			this.options = Object.extend(Object.clone(this.options), options || { });
		},
		generateSegmentedBar: function () {
			if (this.value > 1 || this.value < 0) {
				console.log("Invalid segmented bar value");
				return;
			}
			var bar = new Element('div', {
				'class': 'segmented-bar',
				'title': Math.round(this.value * 100) + '%' || ''
			});
			var valueUnit = 1 / this.options.segments;
			for (var i = 0; i < this.options.segments; ++i) {
				var segmentFill = 100 * Math.min(Math.max((this.value - i * valueUnit) / valueUnit, 0), 1);
				var segment = new Element('span', {
					'class': 'segmented-unit'
				});
				var segmentFillElement = new Element('span', {
					'class': 'segmented-unit-fill'
				});
				segmentFillElement.setStyle({
					width: segmentFill + '%'
				});
				segment.insert(segmentFillElement);
				bar.insert(segment);
			}
			if (this.options.displayValue) {
				bar.insert(' ' + Math.round(this.value * 100) + '%');
			}
			return bar;
		}
	});
	return PhenoTips;
})(PhenoTips || {});


var PhenoTips = (function (PhenoTips) {

	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};

	if (typeof XWiki.widgets.XList == 'undefined') {
		if (typeof console != "undefined" && typeof console.warn == "function") {
			console.warn("[Suggest widget] Required class missing: XWiki.widgets.XList");
		}
	} else {
		widgets.XList = XWiki.widgets.XList;
		widgets.XListItem = XWiki.widgets.XListItem;
		/**
		 * Suggest class.
		 * Provide value suggestions to users when starting to type in a text input.
		 */
		widgets.Suggest = Class.create({
			options: {
				// The minimum number of characters after which to trigger the suggest
				minchars: 1,
				// The HTTP method for the AJAX request
				method: "get",
				// The name of the request parameter holding the input stub
				varname: "input",
				// The CSS classname of the suggest list
				className: "ajaxsuggest",
				timeout: 2500,
				delay: 500,
				offsety: 0,
				// Display a "no results" message, or simply hide the suggest box when no suggestions are available
				shownoresults: true,
				// The message to display as the "no results" message
				noresults: "No results!",
				maxheight: 250,
				cache: false,
				seps: "",
				icon: null,
				// The name of the JSON variable or XML element holding the results.
				// "results" for the old suggest, "searchResults" for the REST search.
				resultsParameter: "results",
				// The name of the JSON parameter or XML attribute holding the result identifier.
				// "id" for both the old suggest and the REST search.
				resultId: "id",
				// The name of the JSON parameter or XML attribute holding the result value.
				// "value" for the old suggest, "pageFullName" for the REST page search.
				resultValue: "value",
				// The name of the JSON parameter or XML attribute holding the result auxiliary information.
				// "info" for the old suggest, "pageFullName" for the REST search.
				resultInfo: "info",
				// The name of the JSON parameter or XML attribute holding the result category.
				resultCategory: "category",
				// The name of the JSON parameter or XML attribute holding the result alternative name.
				resultAltName: "",
				// The name of the JSON parameter or XML attribute holding the result icon.
				resultIcon: "icon",
				// The name of the JSON parameter or XML attribute holding a potential result hint (displayed next to the value).
				resultHint: "hint",
				// What kind of tooltip (if any) should be attached to each entry. Default: none.
				tooltip: false,
				// The id of the element that will hold the suggest element
				//parentContainer : "body",
				// Should results fragments be highlighted when matching typed input
				highlight: true,
				// Fade the suggestion container on clear
				fadeOnClear: true,
				// Show a 'hide suggestions' button
				enableHideButton: true,
				insertBeforeSuggestions: null,
				// Should id be displayed or hidden
				displayId: false,
				// Should value be displayed as a hint
				displayValue: false,
				// Display value prefix text
				displayValueText: "Value :",
				// How to align the suggestion list when its width is different from the input field width
				align: "left",
				// When there are several suggest sources, should the widget displays only one, unified, "loading" indicator for all requests undergoing,
				// Or should it displays one loading indicator per request next to the corresponding source.
				unifiedLoader: false,
				// The DOM node to use to display the loading indicator when in mode unified loader (it will receive a "loading" class name for the time of the loading)
				// Default is null, which falls back on the input itself. This option is used only when unifiedLoader is true.
				loaderNode: null,
				// A function returning true or false for each fetched suggestion. If defined, only suggestions for which 'true' is returned
				// are added to the list
				filterFunc: null
			},
			sInput: "",
			nInputChars: 0,
			aSuggestions: [],
			iHighlighted: null,
			isActive: false,

			//Added for GEL(GenomicsEngland)................................................
			//to get track of the number of rows loaded in case of using pagination
			resultTotal:0,
			resultPage:-1,
			resultLimit:10,
			resultHasMore: false,
			//..............................................................................

			/**
			 * Initialize the suggest
			 *
			 * @param {Object} fld the suggest field
			 * @param {Object} param the options
			 */
			initialize: function (fld, param) {

				if (!fld) {
					return false;
				}
				this.setInputField(fld);

				// Clone default options from the prototype so that they are not shared and extend options with passed parameters
				this.options = Object.extend(Object.clone(this.options), param || { });
				if (typeof this.options.sources == 'object' && this.options.sources.length > 1) {
					// We are in multi-sources mode
					this.sources = this.options.sources;
				} else {
					// We are in mono-source mode
					this.sources = this.options;
				}

				// Flatten sources
				this.sources = [ this.sources ].flatten().compact();

				// Reset the container if the configured parameter is not valid
				if (!$(this.options.parentContainer)) {
					this.options.parentContainer = $(document.body);
				}

				if (this.options.seps) {
					this.seps = this.options.seps;
				} else {
					this.seps = "";
				}

				// Initialize a request number that will keep track of the latest request being fired.
				// This will help to discard potential non-last requests callbacks ; this in order to have better performance
				// (less unneccessary DOM manipulation, and less unneccessary highlighting computation).
				this.latestRequest = 0;

			},

			/**
			 * Sets or replace the input field associated with this suggest.
			 */
			setInputField: function (input) {
				if (this.fld) {
					this.fld.stopObserving();
				}
				this.fld = $(input);
				this.fld._suggestWidget = this;
				// Bind the key listeners on the input field.
				this.fld.observe("keyup", this.onKeyUp.bindAsEventListener(this));
				if (Prototype.Browser.IE || Prototype.Browser.WebKit) {
					this.fld.observe("keydown", this.onKeyPress.bindAsEventListener(this));
				} else {
					this.fld.observe("keypress", this.onKeyPress.bindAsEventListener(this));
				}
				this.fld.observe("paste", this.onPaste.bindAsEventListener(this));

				// Prevent normal browser autocomplete
				this.fld.setAttribute("autocomplete", "off");

				this.fld.observe("blur", function (event) {
					// Make sure any running request will be dropped after the input field has been left
					this.latestRequest++;

				}.bind(this));
			},

			/**
			 * Treats normal characters and triggers the autocompletion behavior. This is needed since the field value is not
			 * updated when keydown/keypress are called, so the suggest would work with the previous value. The disadvantage is
			 * that keyUp is not fired for each stroke in a long keypress, but only once at the end. This is not a real problem,
			 * though.
			 */
			onKeyUp: function (event) {
				var key = event.keyCode;
				switch (key) {
					// Ignore special keys, which are treated in onKeyPress
					case Event.KEY_RETURN:
					case Event.KEY_ESC:
					case Event.KEY_UP:
					case Event.KEY_DOWN:
						break;
					default:
					{
						// If there are separators in the input string, get suggestions only for the text after the last separator
						// TODO The user might be typing in the middle of the field, not in the last item. Do a better detection by
						// comparing the new value with the old one.
						if (this.seps) {
							var lastIndx = -1;
							for (var i = 0; i < this.seps.length; i++) {
								if (this.fld.value.lastIndexOf(this.seps.charAt(i)) > lastIndx) {
									lastIndx = this.fld.value.lastIndexOf(this.seps.charAt(i));
								}
							}
							if (lastIndx == -1) {

								this.getSuggestions(this.fld.value);
							} else {

								this.getSuggestions(this.fld.value.substring(lastIndx + 1));
							}
						} else {

							this.getSuggestions(this.fld.value);
						}
					}
				}
			},
			/**
			 * Use the key press routine to search as if some "other" key was pressed;
			 * Pasted value is not yet available at the time of the "paste" event, so schedule
			 * the handler to fire immediately after paste processing is done.
			 */
			onPaste: function (event) {
				setTimeout(function () {
					this.onKeyUp({"keyCode": null});
				}.bind(this), 0);
			},
			/**
			 * Treats Up and Down arrows, Enter and Escape, affecting the UI meta-behavior. Enter puts the currently selected
			 * value inside the target field, Escape closes the suggest dropdown, Up and Down move the current selection.
			 */
			onKeyPress: function (event) {
				if (!$(this.isActive)) {
					// Stop Return from submitting the form
					if (event.keyCode == Event.KEY_RETURN) {
						Event.stop(event);
					}
					// Let all other key events pass through if the UI is not displayed
					return;
				}
				var key = event.keyCode;

				switch (key) {
					case Event.KEY_RETURN:
						this.setHighlightedValue();
						Event.stop(event);
						break;
					case Event.KEY_ESC:
						this.clearSuggestions();
						Event.stop(event);
						break;
					case Event.KEY_UP:
						this.changeHighlight(key);
						Event.stop(event);
						break;
					case Event.KEY_DOWN:
						this.changeHighlight(key);
						Event.stop(event);
						break;
					default:
						break;
				}
			},

			/**
			 * Get suggestions
			 *
			 * @param {Object} val the value to get suggestions for
			 */
			getSuggestions: function (val) {

				// if input stays the same, do nothing
				//
				val = val.strip().toLowerCase();
				if (val == this.sInput && val.length > 1) {
					return false;
				}

				if (val.length == 0) {
					this.sInput = "";
					this.clearSuggestions();
					return false;
				}
				// input length is less than the min required to trigger a request
				// reset input string
				// do nothing
				//
				if (val.length < this.options.minchars) {
					this.sInput = "";
					return false;
				}

				// if caching enabled, and user is typing (ie. length of input is increasing)
				// filter results out of aSuggestions from last request
				//
				if (val.length > this.nInputChars && this.aSuggestions.length && this.options.cache) {
					var arr = [];
					for (var i = 0; i < this.aSuggestions.length; i++) {
						if (this.aSuggestions[i].value.substr(0, val.length).toLowerCase() == val) {
							arr.push(this.aSuggestions[i]);
						}
					}

					this.sInput = val;
					this.nInputChars = val.length;
					this.aSuggestions = arr;

					this.createList(this.aSuggestions);

					return false;
				} else {

					//Added for GEL(GenomicsEngland)................................................
					//As it is a new request, set resultPage offset to -1
					this.resultPage = -1;
					//..............................................................................

					// do new request
					this.sInput = val;
					this.nInputChars = val.length;

					//Added for GEL(GenomicsEngland).....................................................................
					//this.container is the main container of the suggestion and we use it later to access LoadMore text
					this.container = this.prepareContainer();
					//...................................................................................................

					this.latestRequest++;
					var pointer = this;
					var requestId = this.latestRequest;
					clearTimeout(this.ajID);
					this.ajID = setTimeout(function () {
						
						pointer.doAjaxRequests(requestId)
					}, this.options.delay);

				}
				return false;
			},

			/**
			 * Fire the AJAX Request(s) that will get suggestions
			 */
			doAjaxRequests: function (requestId) {

				if (this.fld.value.length < this.options.minchars) {
					return;
				}

				for (var i = 0; i < this.sources.length; i++) {
					var source = this.sources[i];

					// create ajax request
					var query = this.fld.value.strip();
					var parameters = {};
					if (this.options.queryProcessor != null && typeof(this.options.queryProcessor.generateParameters) == "function") {
						parameters = this.options.queryProcessor.generateParameters(query);
					}
					if (this.options.queryProcessor != null && typeof(this.options.queryProcessor.processQuery) == "function") {
						query = this.options.queryProcessor.processQuery(query);
					}
					//Added by Soheil for GEL(GenomicsEngland)
					//Load the ajax call path from scriptFunction if it's provided otherwise use script string
					var url = "";
					if (source.scriptFunction != undefined && typeof source.scriptFunction === "function"){
						url = source.scriptFunction() + source.varname + "=" + encodeURIComponent(query);
					}else{
						url = source.script + source.varname + "=" + encodeURIComponent(query);
					}

					var method = source.method || "get";
					var headers = {};
					if (source.json) {
						headers.Accept = "application/json";
					} else {
						headers.Accept = "application/xml";
					}

					var _GELThisAjaxCall = this;
					//Added for GEL(GenomicsEngland) .........................................................................
					//If the suggestion configured to use pagination, then pass "page" and "limit" parameters into the query
					//it is used for GEL SnomedCT queries
					if(_GELThisAjaxCall.options.resultUsePagination && _GELThisAjaxCall.options.resultUsePagination()) {
						this.resultPage = this.resultPage + 1;
						url = url + "&page=" + this.resultPage + "&limit=" + this.resultLimit;
					}
					//........................................................................................................


					var ajx = new Ajax.Request(url, {
						method: method,
						parameters: parameters,
						requestHeaders: headers,
						onCreate: function () {
							this.fld.addClassName("loading");
						}.bind(this),
						onSuccess: function(_GELResult){

							//Added for GEL(GenomicsEngland) .........................................................................
							//If the request is a pagination one, then get 'more' and 'total' values from the result
							if(_GELThisAjaxCall.options.resultUsePagination && _GELThisAjaxCall.options.resultUsePagination()){
								var result = _GELResult.responseJSON;
								_GELThisAjaxCall.resultHasMore = result.more;
								_GELThisAjaxCall.resultTotal   = result.total;
								if(!result.more){
									_GELThisAjaxCall.hideLoadMore();
								}else{
									_GELThisAjaxCall.updateLoadMore(_GELThisAjaxCall.resultPage, _GELThisAjaxCall.resultLimit, _GELThisAjaxCall.resultTotal)
								}
							}
							//........................................................................................................


							//Changed by SOHEIL for GEL(GenomicsEngland)
							//this.setSuggestions.bindAsEventListener(this, source, requestId)
							_GELThisAjaxCall.setSuggestions(_GELResult, source, requestId);
						},
						onFailure: function (response) {

							//new PhenoTips.widgets.Notification("Failed to retrieve suggestions : ')" + response.statusText, "error", {timeout: 5});
							alert("Failed to retrieve suggestions : " + response.statusText);
						},
						onComplete: function () {

							if (requestId < this.latestRequest) {
								return;
							}
							this.fld.removeClassName("loading");
						}.bind(this)
					});
				}
			},

			/**
			 * Set suggestions
			 *
			 * @param {Object} req
			 * @param {Object} source
			 * @param {Number} requestId the identifier of the request for which this callback is triggered.
			 */
			setSuggestions: function (req, source, requestId) {

				// If there has been one or several requests fired in the mean time (between the time the request for which this callback
				// has been triggered and the time of the callback itself) ; we don't do anything and leave it to following callbacks to
				// set potential suggestions
				if (requestId < this.latestRequest) {
					return;
				}

				this.aSuggestions = this.getSuggestionList(req, source);
				this.createList(this.aSuggestions, source);
			},

			getSuggestionList: function (req, source) {

				var aSuggestions = [];
				if (source && source.json) {
					var jsondata = req.responseJSON;
					if (!jsondata) {
						return false;
					}
					var results = jsondata[source.resultsParameter || this.options.resultsParameter];

					var _getResultFieldValue = function (data, fieldName) {
						return data && data[fieldName] || '';
					}

					var _getResultFieldValueAsArray = function (data, fieldName) {
						return new Array(data && data[fieldName] || '').flatten();
					};
				} else {
					var xmldata = req.responseXML;
					if (!xmldata) {
						return false;
					}
					var results = xmldata.getElementsByTagName((source && source.resultsParameter) || this.options.resultsParameter);

					var _getResultFieldValue = function (data, selector) {
						var element = data && Element.down(data, selector);
						return element && element.firstChild && element.firstChild.nodeValue || '';
					}

					var _getResultFieldValueAsArray = function (data, selector) {
						var result = new Array();
						if (data) {
							Element.select(data, selector).each(function (item) {
								var value = item.firstChild && item.firstChild.nodeValue;
								if (value) {
									result.push(value);
								}
							});
						}
						return result;
					};
				}

				var _getExpandCollapseTriggerSymbol = function (isCollapsed) {
					if (isCollapsed) return "&#x25B8;";
					return "&#x25BE;";
				}
				for (var i = 0; i < results.length; i++) {
					var info = new Element("dl");
					for (var section in this.options.resultInfo) {
						var sOptions = this.options.resultInfo[section];

						sectionClass = section.strip().toLowerCase().replace(/[^a-z0-9 ]/gi, '').replace(/\s+/gi, "-");

						var sectionState = ""
						if (sOptions.collapsed) {
							sectionState = "collapsed";
						}

						var processingFunction = sOptions.processor;

						if (sOptions.extern) {
							var trigger = new Element("a").update(section);
							trigger._processingFunction = processingFunction;
							info.insert({"bottom": new Element("dt", {'class': sectionState + " " + sectionClass}).insert({'bottom': trigger})});
							trigger._processingFunction.call(this, trigger);
							continue;
						}

						var selector = sOptions.selector;
						if (!selector) {
							continue;
						}

						var sectionContents = null;
						_getResultFieldValueAsArray(results[i], selector).each(function (item) {
							var text = item || '';
							if (typeof (processingFunction) == "function") {
								text = processingFunction(text);
							}
							if (text == '') {
								return;
							}
							if (!sectionContents) {
								var trigger = new Element("a", {'class': 'expand-tool'}).update(_getExpandCollapseTriggerSymbol(sOptions.collapsed));
								info.insert({"bottom": new Element("dt", {'class': sectionState}).insert({'top': trigger}).insert({'bottom': section})});
								sectionContents = new Element("dd", {'class': 'expandable'});
								info.insert({"bottom": sectionContents});
								trigger.observe('click', function (event) {
									event.stop();
									trigger.up().toggleClassName('collapsed');
									trigger.update(_getExpandCollapseTriggerSymbol(trigger.up().hasClassName('collapsed')));
								}.bindAsEventListener(this));
							}
							sectionContents.insert({"bottom": new Element("div").update(text)});
						});
					}
					if (!info.hasChildNodes()) {
						info = '';
					}
					if (this.options.resultCategory) {
						var category = new Element("span", {'class': 'hidden term-category'});
						_getResultFieldValueAsArray(results[i], this.options.resultCategory).each(function (c) {
							category.insert(new Element('input', {'type': 'hidden', 'value': c}));
						});
					}
					if (!this.options.resultCategory || !category.hasChildNodes()) {
						category = '';
					}

					if (this.options.resultAltName) {
						var bestNameMatch = '';
						var name = _getResultFieldValue(results[i], source.resultValue || this.options.resultValue);
						var altNames = _getResultFieldValueAsArray(results[i], source.resultAltName || this.options.resultAltName);
						var nameMatchScore = this.computeSimilarity(name, this.sInput);
						for (var k = 0; k < altNames.length; ++k) {
							var altNameMatchScore = this.computeSimilarity(altNames[k], this.sInput);
							if (altNameMatchScore > nameMatchScore) {
								bestNameMatch = altNames[k];
								nameMatchScore = altNameMatchScore;
							}
						}
					}

					aSuggestions.push({
						'id': _getResultFieldValue(results[i], source.resultId || this.options.resultId),
						'value': _getResultFieldValue(results[i], source.resultValue || this.options.resultValue),
						'valueAll': results[i],
						'altName': bestNameMatch,
						'info': info,
						'category': category
					});
				}
				return aSuggestions;
			},

			/**
			 * Compute the Smith Waterman similarity between two strings
			 */
			computeSimilarity: function (str1, str2) {
				var score;
				var maxSoFar = 0;
				var gapCost = 2;

				// get values
				var a = str1;
				var m = a.length;

				//n is the length of currFieldValue
				var b = str2;
				var n = b.length;

				//declare the matrix
				var d = new Array();

				for (i = 0; i < n; i++) {
					d[i] = new Array();

					// get the substitution score
					score = (a.charAt(i) == b.charAt(0)) ? 1 : -1;

					if (i == 0) {
						d[0][0] = Math.max(0, -gapCost, score);
					} else {
						d[i][0] = Math.max(0, d[i - 1][0] - gapCost, score);
					}

					//update max possible if available
					if (d[i][0] > maxSoFar) {
						maxSoFar = d[i][0];
					}
				}

				for (j = 0; j < m; j++) {
					// get the substitution score
					score = (a.charAt(0) == b.charAt(j)) ? 1 : -1;

					if (j == 0) {
						d[0][0] = Math.max(0, -gapCost, score);
					} else {
						d[0][j] = Math.max(0, d[0][j - 1] - gapCost, score);
					}

					//update max possible if available
					if (d[0][j] > maxSoFar) {
						maxSoFar = d[0][j];
					}
				}

				// cycle through rest of table filling values from the lowest cost value of the three part cost function
				for (i = 1; i < n; i++) {
					for (j = 1; j < m; j++) {
						// get the substitution score
						score = (a.charAt(i) == b.charAt(j)) ? 1 : -1;

						// find lowest cost at point from three possible
						d[i][j] = Math.max(0, d[i - 1][j] - gapCost, d[i][j - 1] - gapCost, d[i - 1][j - 1] + score);
						//update max possible if available
						if (d[i][j] > maxSoFar) {
							maxSoFar = d[i][j];
						}
					}
				}
				// return max value within matrix as holds the maximum edit score
				return maxSoFar;
			},


			/**
			 * Creates the container that will hold one or multiple source results.
			 */
			prepareContainer: function () {

				var crtContainer = $(this.options.parentContainer).down('.suggestItems');

				if (crtContainer && crtContainer.__targetField != this.fld) {
					if (crtContainer.__targetField) {
						crtContainer.__targetField._suggest.clearSuggestions();
					} else {
						crtContainer.remove();
					}
					crtContainer = false;
				}

				if (!crtContainer) {
					// If the suggestion top container is not in the DOM already, we create it and inject it

					var div = new Element("div", { 'class': "suggestItems " + this.options.className });

					// Get position of target textfield
					var pos = $(this.options.parentContainer).tagName.toLowerCase() == 'body' ? this.fld.cumulativeOffset() : this.fld.positionedOffset();

					// Container width is passed as an option, or field width if no width provided.
					// The 2px substracted correspond to one pixel of border on each side of the field,
					// this allows to have the suggestion box borders well aligned with the field borders.
					// FIXME this should be computed instead, since border might not always be 1px.
					var containerWidth = this.options.width ? this.options.width : (this.fld.offsetWidth - 2)

					if (this.options.align == 'left') {
						// Align the box on the left
						div.style.left = pos.left + "px";
					} else if (this.options.align == "center") {
						// Align the box to the center
						div.style.left = pos.left + (this.fld.getWidth() - containerWidth - 2) / 2 + "px";
					} else {
						// Align the box on the right.
						// This has a visible effect only when the container width is not the same as the input width
						div.style.left = (pos.left - containerWidth + this.fld.offsetWidth - 2) + "px";
					}

					div.style.top = (pos.top + this.fld.offsetHeight + this.options.offsety) + "px";
					div.style.width = containerWidth + "px";

					// set mouseover functions for div
					// when mouse pointer leaves div, set a timeout to remove the list after an interval
					// when mouse enters div, kill the timeout so the list won't be removed
					var pointer = this;
					div.onmouseover = function () {
						pointer.killTimeout()
					}
					div.onmouseout = function () {
						pointer.resetTimeout()
					}

					this.resultContainer = new Element("div", {'class': 'resultContainer'});
					div.appendChild(this.resultContainer);

					// add DIV to document
					$(this.options.parentContainer).insert(div);

					this.container = div;

					if (this.options.insertBeforeSuggestions) {
						this.resultContainer.insert(this.options.insertBeforeSuggestions);
					}

					document.fire("ms:suggest:containerCreated", {
						'container': this.container,
						'suggest': this
					});
				}

				if (this.sources.length > 1) {
					// If we are in multi-source mode, we need to prepare a sub-container for each of the suggestion source
					for (var i = 0; i < this.sources.length; i++) {

						var source = this.sources[i];
						source.id = i

						if (this.resultContainer.down('.results' + source.id)) {
							// If the sub-container for this source is already present, we just re-initialize it :
							// - remove its content
							// - set it as loading
							if (this.resultContainer.down('.results' + source.id).down('ul')) {
								this.resultContainer.down('.results' + source.id).down('ul').remove();
							}
							if (!this.options.unifiedLoader) {
								this.resultContainer.down('.results' + source.id).down('.sourceContent').addClassName('loading');
							}
							else {
								(this.options.loaderNode || this.fld).addClassName("loading");
								this.resultContainer.down('.results' + source.id).addClassName('hidden loading');
							}
						}
						else {
							// The sub-container for this source has not been created yet
							// Really create the subcontainer for this source and inject it in the global container
							var sourceContainer = new Element('div', {'class': 'results results' + source.id}),
								sourceHeader = new Element('div', {'class': 'sourceName'});

							if (this.options.unifiedLoader) {
								sourceContainer.addClassName('hidden loading');
							}

							if (typeof source.icon != 'undefined') {
								// If there is an icon for this source group, set it as background image
								var iconImage = new Image();
								iconImage.onload = function () {
									this.sourceHeader.setStyle({
										backgroundImage: "url(" + this.iconImage.src + ")"
									});
									this.sourceHeader.setStyle({
										textIndent: (this.iconImage.width + 6) + 'px'
									});
								}.bind({
										sourceHeader: sourceHeader,
										iconImage: iconImage
									});
								iconImage.src = source.icon;
							}
							sourceHeader.insert(source.name)
							sourceContainer.insert(sourceHeader);
							var classes = "sourceContent " + (this.options.unifiedLoader ? "" : "loading");
							sourceContainer.insert(new Element('div', {'class': classes}));

							if (typeof source.before !== 'undefined') {
								this.resultContainer.insert(source.before);
							}
							this.resultContainer.insert(sourceContainer);
							if (typeof source.after !== 'undefined') {
								this.resultContainer.insert(source.after);
							}
						}
					}
				} else {
					// In mono-source mode, reset the list if present
					if (this.resultContainer.down("ul")) {
						this.resultContainer.down("ul").remove();
					}
				}

				var ev = this.container.fire("ms:suggest:containerPrepared", {
					'container': this.container,
					'suggest': this
				});

				this.container.__targetField = this.fld;
				if (this.options.enableHideButton && !this.container.down('.hide-button')) {

					//Commented for GEL(GenomicsEngland) .........................................................................
					//We do not need to show "hide suggestions" text
					//var hideButton = new Element('span', {'class': 'hide-button', 'style':'float:left;'}).update("hide suggestions");
					//hideButton.observe('click', this.clearSuggestions.bindAsEventListener(this));
					//this.container.insert({top: new Element('div', {'class': 'hide-button-wrapper'}).update(hideButton)});

					//hideButton = new Element('span', {'class': 'hide-button'}).update("hide suggestions");
					//hideButton.observe('click', this.clearSuggestions.bindAsEventListener(this));
					//this.container.insert({bottom: new Element('div', {'class': 'hide-button-wrapper'}).update(hideButton)});
					//............................................................................................................

					//Added for GEL(GenomicsEngland) ...................................................................
					//If suggestion uses 'pagination', then show 'Load more' text
					var pagination = (this.options.resultUsePagination ? this.options.resultUsePagination() : false);
					if(pagination){
						hideButton = new Element('span', {'class': 'hide-button loadMore', 'style':'float:left;'}).update("Load more");
						hideButton.observe('click', this.loadMode.bindAsEventListener(this));
						this.container.insert({bottom: new Element('div', {'class': 'hide-button-wrapper'}).update(hideButton)});
					}
					//..................................................................................................
				}
				return this.container;
			},

			//Added for GEL(GenomicsEngland) ...................................................................
			//This will hide 'Load More' text
			hideLoadMore: function(){
				var container = this.container;
				if(container && container.select("span.loadMore").length > 0){
					(container.select("span.loadMore")[0]).hide();
				}
			},

			//Added for GEL(GenomicsEngland) ...............................................................................
			//This will update 'Load More' text and add the number of items that are loaded already and the total number
			updateLoadMore: function(page, limit, total){
				var container = this.container;
				var loadMoreSpan = container.select("span.loadMore");
				if(container && loadMoreSpan.length > 0){
					loadMoreSpan[0].update("(" + (page + 1) * 10 +"/"+ total+") Load more");
				}
			},

			//Added for GEL(GenomicsEngland) ...............................................................................
			//This will call the back-end service to load more, this is called when the user clicks on 'Load more' text
			loadMode : function(){
				// do new request
				var val = this.fld.value;
				this.sInput = val;
				this.nInputChars = val.length;

				this.latestRequest++;
				var pointer = this;
				var requestId = this.latestRequest;
				clearTimeout(this.ajID);
				this.ajID = setTimeout(function () {
					pointer.doAjaxRequests(requestId)
				}, this.options.delay);

				return false;
			},

			/**
			 * Create the HTML list of suggestions.
			 *
			 * @param {Object} arr
			 * @param {Object} source the source for data for which to create this list of results.
			 */
			createList: function (arr, source) {

				this.isActive = true;
				var pointer = this;

				this.killTimeout();
				this.clearHighlight();

				// create holding div
				//
				if (this.sources.length > 1) {
					var div = this.resultContainer.down(".results" + source.id);
					if (arr.length > 0 || this.options.shownoresults) {
						div.down('.sourceContent').removeClassName('loading');
						this.resultContainer.down(".results" + source.id).removeClassName("hidden loading");
					}

					// If we are in mode "unified loader" (showing one loading indicator for all requests and not one per request)
					// and there aren't any source still loading, we remove the unified loading status.
					if (this.options.unifiedLoader && !this.resultContainer.down("loading")) {
						(this.options.loaderNode || this.fld).removeClassName("loading");
					}
				}
				else {
					var div = this.resultContainer;
				}

				// if no results, and shownoresults is false, go no further
				if (arr.length == 0 && !this.options.shownoresults) {
					return false;
				}

				//Commented for GEL(GenomicsEngland) .................................................
				// Ensure any previous list of results for this source gets removed
				//if (div.down('ul')) {
				//	div.down('ul').remove();
				//}
				//....................................................................................

				//Added for GEL(GenomicsEngland) .....................................................
				//If we are loading more items and the 'ul' is already there,
				//then just add new item in it otherwise create 'ul'
				var list = undefined;
				if (div.down('ul')) {
					var oldUL = div.down('ul');
					var newUL = this.createListElement(arr, pointer);
					for(var i = 0; i < newUL.select("li").length;i++) {
						oldUL.appendChild(newUL.select("li")[i]);
					}
					list = oldUL;
				}
				else{
					list = this.createListElement(arr, pointer);
					div.appendChild(list);
				}
				//....................................................................................

				//Commented for GEL(GenomicsEngland) .................................................
				// create and populate list
				//var list = this.createListElement(arr, pointer);
				//div.appendChild(list);
				//....................................................................................
				Event.fire(document, "xwiki:dom:updated", {elements: [list]});

				this.suggest = div;

				// remove list after an interval
				var pointer = this;
				if (this.options.timeout > 0) {
					this.toID = setTimeout(function () {
						pointer.clearSuggestions()
					}, this.options.timeout);
				}
				this.highlightFirst();
			},

			createListElement: function (arr, pointer) {
				var list = new PhenoTips.widgets.XList([], {
					icon: this.options.icon,
					classes: 'suggestList',
					eventListeners: {
						'click': function () {
							pointer.setHighlightedValue();
							return false;
						},
						'mouseover': function () {
							pointer.setHighlight(this.getElement());
						}
					}
				});

				if (this.fld.hasClassName('accept-value')) {
					var customItemId = this.fld.value.replace(/[^a-z0-9_]+/gi, "_");
					var customItemCategoryInfo = this.fld.next('input[name="_category"]');
					var customItemCategories = customItemCategoryInfo && customItemCategoryInfo.value.split(",") || [];
					var customItemCategoriesElt = new Element('div', {'class': 'hidden term-category'});
					var categoryFieldName = this.fld.name + "__" + customItemId + "__category";
					customItemCategories.each(function (c) {
						if (c) {
							customItemCategoriesElt.insert(new Element('input', {'type': 'hidden', name: categoryFieldName, value: c}));
						}
					});

					//Added for GEL (GenomicsEngland) ..................................................................
					// "your text, not a standard term" add this text just in the begining of the results list
					var pagination = (this.options.resultUsePagination ? this.options.resultUsePagination() : false);
					if(!pagination || (pagination && this.resultPage == 0)){
						list.addItem(this.generateListItem({
							id: this.fld.value,
							value: this.fld.value,
							category: customItemCategoriesElt,
							info: new Element('div', {'class': 'hint'}).update('(your text, not a standard term)')
						}, 'custom-value', true));
					}
					//..................................................................................................
				}



				// loop throught arr of suggestions
				// creating an XlistItem for each suggestion
				//
				for (var i = 0, len = arr.length; i < len; i++) {
					if (!this.options.filterFunc || this.options.filterFunc(arr[i])) {
						list.addItem(this.generateListItem(arr[i]));
					}
				}
				// no results
				if (arr.length == 0) {
					list.addItem(new PhenoTips.widgets.XListItem(this.options.noresults, {
						'classes': 'noSuggestion',
						noHighlight: true }));
				}


				//Commented for GEL(GenomicsEngland) ...................................................................
				//show the text '(your text, not a standard term)' in the begining of the list not at the end
				//if (this.fld.hasClassName('accept-value')) {
				//	var customItemId = this.fld.value.replace(/[^a-z0-9_]+/gi, "_");
				//	var customItemCategoryInfo = this.fld.next('input[name="_category"]');
				//	var customItemCategories = customItemCategoryInfo && customItemCategoryInfo.value.split(",") || [];
				//	var customItemCategoriesElt = new Element('div', {'class': 'hidden term-category'});
				//	var categoryFieldName = this.fld.name + "__" + customItemId + "__category";
				//	customItemCategories.each(function (c) {
				//		if (c) {
				//			customItemCategoriesElt.insert(new Element('input', {'type': 'hidden', name: categoryFieldName, value: c}));
				//		}
				//	});
				//	list.addItem(this.generateListItem({
				//		id: this.fld.value,
				//		value: this.fld.value,
				//		category: customItemCategoriesElt,
				//		info: new Element('div', {'class': 'hint'}).update('(your text, not a standard term)')
				//	}, 'custom-value', true));
				//}
				//......................................................................................................
				return list.getElement();
			},

			generateListItem: function (data, cssClass, disableTooltip) {
				var displayNode = new Element("div", {'class': 'tooltip-' + this.options.tooltip});
				// If the search result contains an icon information, we insert this icon in the result entry.
				if (data.icon) {
					displayNode.insert(new Element("img", {'src': data.icon, 'class': 'icon' }));
				}
				if (this.options.displayId) {
					displayNode.insert(new Element('span', {'class': 'suggestId'}).update(data.id.escapeHTML()));
				}
				displayNode.insert(new Element('span', {'class': 'suggestValue'}).update(data.value.escapeHTML()));

				if (this.options.tooltip && !disableTooltip) {
					var infoTool = new Element('span', {'class': 'fa fa-info-circle xHelpButton ' + this.options.tooltip, 'title': data.id});
					infoTool.observe('click', function (event) {
						event.stop()
					});
					displayNode.insert(' ').insert(infoTool);
				}
				var displayInfo = new Element('div', {'class': 'suggestInfo'}).update(data.info);
				displayNode.insert(displayInfo);
				if (data.altName) {
					displayInfo.insert({'top': new Element('span', {'class': 'matching-alternative-name'}).update(data.altName.escapeHTML())});
				}

				var valueNode = new Element('div')
					.insert(new Element('span', {'class': 'suggestId'}).update(data.id.escapeHTML()))
					.insert(new Element('span', {'class': 'suggestValue'}).update(data.value.escapeHTML()))
					.insert(new Element('div', {'class': 'suggestCategory'}).update(data.category));
				valueNode.store('itemData', data);

				var item = new PhenoTips.widgets.XListItem(displayNode, {
					containerClasses: 'suggestItem ' + (cssClass || ''),
					value: valueNode,
					noHighlight: true // we do the highlighting ourselves
				});

				Event.fire(this.fld, "ms:suggest:suggestionCreated", {element: item.getElement(), suggest: this});

				return item;
			},

			/**
			 * Emphesize the elements in passed value that matches one of the words typed as input by the user.
			 *
			 * @param String input the (typed) input
			 * @param String value the value to emphasize
			 */
			emphasizeMatches: function (input, value) {
				// If the source declares that results are matching, we highlight them in the value
				var output = value,
				// Separate words (called fragments hereafter) in user input
					fragments = input.split(' ').uniq().compact(),
					offset = 0,
					matches = {};

				for (var j = 0, flen = fragments.length; j < flen; j++) {
					// We iterate over each fragments, and try to find one or several matches in this suggestion
					// item display value.
					var index = output.toLowerCase().indexOf(fragments[j].toLowerCase());
					while (index >= 0) {
						// As long as we have matches, we store their index and replace them in the output string with the space char
						// so that they don't get matched for ever.
						// Note that the space char is the only one safe to use, as it cannot be part of a fragment.
						var match = output.substring(index, index + fragments[j].length),
							placeholder = "";
						fragments[j].length.times(function () {
							placeholder += " ";
						});
						matches[index] = match;
						output = output.substring(0, index) + placeholder + output.substring(index + fragments[j].length);
						index = output.toLowerCase().indexOf(fragments[j].toLowerCase());
					}
				}
				// Now that we have found all matches for all possible fragments, we iterate over them
				// to construct the final "output String" that will be injected as a suggestion item,
				// with all matches emphasized
				Object.keys(matches).sortBy(function (s) {
					return parseInt(s)
				}).each(function (key) {
					var before = output.substring(0, parseInt(key) + offset);
					var after = output.substring(parseInt(key) + matches[key].length + offset);
					// Emphasize the match in the output string that will be displayed
					output = before + "<em>" + matches[key] + "</em>" + after;
					// Increase the offset by 9, which correspond to the number of chars in the opening and closing "em" tags
					// we have introduced for this match in the output String
					offset += 9;
				});

				return output;
			},

			/**
			 * Change highlight
			 *
			 * @param {Object} key
			 */
			changeHighlight: function (key) {
				var list = this.resultContainer;
				if (!list)
					return false;

				var n, elem;

				if (this.iHighlighted) {
					// If there is already a highlighted element, we look for the next or previous highlightable item in the list
					// of results, according to which key has been pressed.
					if (key == Event.KEY_DOWN) {
						elem = this.iHighlighted.next();
						if (!elem && this.iHighlighted.up('div.results')) {
							// if the next item could not be found and multi-source mode, find the next not empty source
							var source = this.iHighlighted.up('div.results').next();
							while (source && !elem) {
								elem = source.down('li');
								source = source.next();
							}
						}
						if (!elem) {
							elem = list.down('li');
						}
					}
					else if (key == Event.KEY_UP) {
						elem = this.iHighlighted.previous();
						if (!elem && this.iHighlighted.up('div.results')) {
							// if the previous item could not be found and multi-source mode, find the previous not empty source
							var source = this.iHighlighted.up('div.results').previous();
							while (source && !elem) {
								elem = source.down('li:last-child');
								source = source.previous();
							}
						}
						if (!elem) {
							elem = list.select('ul')[list.select('ul').length - 1].down('li:last-child');
						}
					}
				}
				else {
					// No item is highlighted yet, so we just look for the first or last highlightable item,
					// according to which key, up or down, has been pressed.
					if (key == Event.KEY_DOWN) {
						if (list.down('div.results')) {
							elem = list.down('div.results').down('li')
						}
						else {
							elem = list.down('li');
						}
					}
					else if (key == Event.KEY_UP)
						if (list.select('li') > 0) {
							elem = list.select('li')[list.select('li').length - 1];
						}
				}

				if (elem) {
					this.setHighlight(elem);
				}
			},

			/**
			 * Set highlight
			 *
			 * @param {Object} n
			 */
			setHighlight: function (highlightedItem) {
				if (this.iHighlighted)
					this.clearHighlight();

				highlightedItem.addClassName("xhighlight");

				this.iHighlighted = highlightedItem;

				this.killTimeout();
			},

			/**
			 * Clear highlight
			 */
			clearHighlight: function () {
				if (this.iHighlighted) {
					this.iHighlighted.removeClassName("xhighlight");
					delete this.iHighlighted;
				}
			},

			highlightFirst: function () {
				if (this.suggest && this.suggest.down('ul')) {
					var first = this.suggest.down('ul').down('li');
					if (first) {
						this.setHighlight(first);
					}
				}
			},

			/**
			 * return true if a suggestion is highlighted, false otherwise
			 */
			hasActiveSelection: function () {
				return this.iHighlighted;
			},

			setHighlightedValue: function () {
				if (this.iHighlighted && !this.iHighlighted.hasClassName('noSuggestion')) {
					var selection, newFieldValue
					if (this.sInput == "" && this.fld.value == "")
						selection = newFieldValue = this.iHighlighted.down(".suggestValue").innerHTML;
					else {
						if (this.seps) {
							var lastIndx = -1;
							for (var i = 0; i < this.seps.length; i++)
								if (this.fld.value.lastIndexOf(this.seps.charAt(i)) > lastIndx)
									lastIndx = this.fld.value.lastIndexOf(this.seps.charAt(i));
							if (lastIndx == -1)
								selection = newFieldValue = this.iHighlighted.down(".suggestValue").innerHTML;
							else {
								newFieldValue = this.fld.value.substring(0, lastIndx + 1) + this.iHighlighted.down(".suggestValue").innerHTML;
								selection = newFieldValue.substring(lastIndx + 1);
							}
						}
						else
							selection = newFieldValue = this.iHighlighted.down(".suggestValue").innerHTML;
					}

					var inputData = this.iHighlighted.down('.value div').retrieve('itemData');
					var data = {
						suggest: this,
						id: inputData.id || this.iHighlighted.down(".suggestId").innerHTML,
						value: inputData.value || this.iHighlighted.down(".suggestValue").innerHTML,
						valueAll: inputData.valueAll,
						info: inputData.info || this.iHighlighted.down(".suggestInfo").innerHTML,
						icon: inputData.icon || (this.iHighlighted.down('img.icon') ? this.iHighlighted.down('img.icon').src : ''),
						category: this.iHighlighted.down(".suggestCategory").innerHTML
					};
					this.acceptEntry(data, selection, newFieldValue);
				}
			},

			acceptEntry: function (data, selection, newFieldValue, silent) {
				var event = Event.fire(this.fld, "ms:suggest:selected", data);

				if (!event.stopped) {
					if (!silent) {
						this.sInput = selection;
						this.fld.value = newFieldValue || this.fld.defaultValue || '';
						this.fld.focus();
						this.clearSuggestions();
					}
					// pass selected object to callback function, if exists
					if (typeof(this.options.callback) == "function") {
						this.options.callback(data);
					}

					//there is a hidden input
					if (this.fld.id.indexOf("_suggest") > 0) {
						var hidden_id = this.fld.id.substring(0, this.fld.id.indexOf("_suggest"));
						var hidden_inp = $(hidden_id);
						if (hidden_inp) {
							hidden_inp.value = info;
						}
					}
				}
			},

			/**
			 * Kill timeout
			 */
			killTimeout: function () {
				clearTimeout(this.toID);
			},

			/**
			 * Reset timeout
			 */
			resetTimeout: function () {
				clearTimeout(this.toID);
				var pointer = this;
				this.toID = setTimeout(function () {
					pointer.clearSuggestions()
				}, 1000000);
			},

			/**
			 * Clear suggestions
			 */
			clearSuggestions: function () {
				this.killTimeout();
				this.isActive = false;
				var ele = $(this.container);
				var pointer = this;
				if (ele && ele.parentNode) {
					if (this.options.fadeOnClear) {
						var fade = new Effect.Fade(ele, {duration: "0.25", afterFinish: function () {
							if ($(pointer.container)) {
								$(pointer.container).remove();
							}
						}});
					}
					else {
						$(this.container).remove();
					}
					document.fire("ms:suggest:clearSuggestions", { 'suggest': this});
				}
			}

		});

	}

	return PhenoTips;

})(PhenoTips || {});

var PhenoTips = (function (PhenoTips) {
// Start PhenoTips augmentation.
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.ModalPopup = Class.create({
		/** Configuration. Empty values will fall back to the CSS. */
		options: {
			idPrefix: "modal-popup-",
			title: "",
			displayCloseButton: true,
			screenColor: "",
			borderColor: "",
			titleColor: "",
			backgroundColor: "",
			screenOpacity: "0.5",
			verticalPosition: "center",
			horizontalPosition: "center",
			resetPositionOnShow: true,
			removeOnClose: false,
			onClose: Prototype.emptyFunction
		},
		/** Constructor. Registers the key listener that pops up the dialog. */
		initialize: function (content, shortcuts, options) {
			/** Shortcut configuration. Action name -> {method: function(evt), keys: string[]}. */
			this.shortcuts = {
				"show": { method: this.showDialog, keys: []},
				"close": { method: this.closeDialog, keys: ['Esc']}
			},

				this.content = content || "Hello world!";
			// Add the new shortcuts
			this.shortcuts = Object.extend(Object.clone(this.shortcuts), shortcuts || { });
			// Add the custom options
			this.options = Object.extend(Object.clone(this.options), options || { });
			// Register a shortcut for showing the dialog.
			this.registerShortcuts("show");

			if (typeof (widgets.ModalPopup.instanceCounter) == 'undefined') {
				widgets.ModalPopup.instanceCounter = 0;
			}
			this.id = ++widgets.ModalPopup.instanceCounter;
		},

		getBoxId: function () {
			return this.options.idPrefix + this.id;
		},

		/** Create the dialog, if it is not already loaded. Otherwise, just make it visible again. */
		createDialog: function (event) {
			this.dialog = new Element('div', {'class': 'msdialog-modal-container'});
			if (this.options.extraDialogClassName) {
				this.dialog.addClassName(this.options.extraDialogClassName);
			}
			// A full-screen semi-transparent screen covering the main document
			this.screen = new Element('div', {'class': 'msdialog-screen'}).setStyle({
				opacity: this.options.screenOpacity,
				backgroundColor: this.options.screenColor
			});
			this.dialog.update(this.screen);
			// The dialog chrome
			this.dialogBox = new Element('div', {'class': 'msdialog-box', 'id': this.getBoxId()});
			if (this.options.extraClassName) {
				this.dialogBox.addClassName(this.options.extraClassName);
			}
			// Insert the content
			this.dialogBox._x_contentPlug = new Element('div', {'class': 'content'});
			this.dialogBox.update(this.dialogBox._x_contentPlug);
			this.dialogBox._x_contentPlug.update(this.content);
			// Add the dialog title
			if (this.options.title) {
				var title = new Element('div', {'class': 'msdialog-title'}).update(this.options.title);
				title.setStyle({"color": this.options.titleColor, "backgroundColor": this.options.borderColor});
				this.dialogBox.insertBefore(title, this.dialogBox.firstChild);
			}
			// Add the close button
			if (this.options.displayCloseButton) {
				var closeButton = new Element('div', {'class': 'msdialog-close', 'title': 'Close'}).update("&#215;");
				closeButton.setStyle({"color": this.options.titleColor});
				closeButton.observe("click", this.closeDialog.bindAsEventListener(this));
				this.dialogBox.insertBefore(closeButton, this.dialogBox.firstChild);
			}
			this.dialog.appendChild(this.dialogBox);
			this.dialogBox.setStyle({
				"textAlign": "left",
				"borderColor": this.options.borderColor,
				"backgroundColor": this.options.backgroundColor
			});
			this.positionDialog();
			// Append to the end of the document body.
			document.body.appendChild(this.dialog);
			if (typeof (Draggable) != 'undefined') {
				new Draggable(this.getBoxId(), {
					handle: $(this.getBoxId()).down('.msdialog-title'),
					scroll: window,
					change: this.updateScreenSize.bind(this)
				});
			}
			this.dialog.hide();
			var __enableUpdateScreenSize = function (event) {
				if (this.dialog.visible()) {
					this.updateScreenSize();
				}
			}.bindAsEventListener(this);
			['resize', 'scroll'].each(function (eventName) {
				Event.observe(window, eventName, __enableUpdateScreenSize);
			}.bind(this));
			Event.observe(document, 'ms:popup:content-updated', __enableUpdateScreenSize);
		},
		positionDialog: function () {
			switch (this.options.verticalPosition) {
				case "top":
					this.dialogBox.setStyle({"top": (document.viewport.getScrollOffsets().top + 6) + "px"});
					break;
				case "bottom":
					this.dialogBox.setStyle({"bottom": ".5em"});
					break;
				default:
					// TODO: smart alignment according to the actual height
					this.dialogBox.setStyle({"top": "35%"});
					break;
			}
			this.dialogBox.setStyle({"left": "", "right": ""});
			switch (this.options.horizontalPosition) {
				case "left":
					this.dialog.setStyle({"textAlign": "left"});
					break;
				case "right":
					this.dialog.setStyle({"textAlign": "right"});
					break;
				default:
					this.dialog.setStyle({"textAlign": "center"});
					this.dialogBox.setStyle({"margin": "auto"});
					break;
			}
		},
		positionDialogInViewport: function (left, top) {
			this.dialogBox.setStyle({
				"left": (document.viewport.getScrollOffsets().left + left) + "px",
				"top": (document.viewport.getScrollOffsets().top + top ) + "px",
				"margin": "0"
			});
		},
		getPositionInViewport: function () {
			return this.dialogBox.viewportOffset();
		},

		updateScreenSize: function () {
			var __getNewDimension = function (eltToFit, dimensionAccessFunction, position) {
				var crtDimension = $(document.documentElement)[dimensionAccessFunction]();
				var viewportDimension = document.viewport.getScrollOffsets()[position] + document.viewport[dimensionAccessFunction]();
				if (eltToFit) {
					var limit = eltToFit.cumulativeOffset()[position] + eltToFit[dimensionAccessFunction]();
				}
				var result = '';
				if (crtDimension < viewportDimension) {
					result = viewportDimension + 'px';
				}
				/*if (limit && crtDimension < limit) {
				 result = limit + 'px';
				 } else if (limit && limit < viewportDimension) {
				 result = viewportDimension + 'px';
				 }*/
				return result;
			};
			this.screen.style.width = __getNewDimension(this.dialogBox, 'getWidth', 'left');
			this.screen.style.height = __getNewDimension(this.dialogBox, 'getHeight', 'top');
		},
		/** Set a class name to the dialog box */
		setClass: function (className) {
			this.dialogBox.addClassName('msdialog-box-' + className);
		},
		/** Remove a class name from the dialog box */
		removeClass: function (className) {
			this.dialogBox.removeClassName('msdialog-box-' + className);
		},
		/** Set the content of the dialog box */
		setContent: function (content) {
			this.content = content;
			this.dialogBox._x_contentPlug.update(this.content);
			this.updateScreenSize();
		},
		/** Called when the dialog is displayed. Enables the key listeners and gives focus to the (cleared) input. */
		showDialog: function (event) {
			if (event) {
				Event.stop(event);
			}
			// Only do this if the dialog is not already active.
			//if (!widgets.ModalPopup.active) {
			//  widgets.ModalPopup.active = true;
			if (!this.active) {
				this.active = true;
				if (!this.dialog) {
					// The dialog wasn't loaded, create it.
					this.createDialog();
				}
				// Start listening to keyboard events
				this.attachKeyListeners();
				// In IE, position: fixed does not work.
				/*if (Prototype.Browser.IE6x) {
				 this.dialog.setStyle({top : document.viewport.getScrollOffsets().top + "px"});
				 this.dialog._x_scrollListener = this.onScroll.bindAsEventListener(this);
				 Event.observe(window, "scroll", this.dialog._x_scrollListener);
				 $$("select").each(function(item) {
				 item._x_initiallyVisible = item.style.visibility;
				 item.style.visibility = 'hidden';
				 });
				 }*/
				// Display the dialog
				this.dialog.show();
				if (this.options.resetPositionOnShow) {
					this.positionDialog();
				}
				this.updateScreenSize();
			}
		},
		onScroll: function (event) {
			this.dialog.setStyle({top: document.viewport.getScrollOffsets().top + "px"});
		},
		/** Called when the dialog is closed. Disables the key listeners, hides the UI and re-enables the 'Show' behavior. */
		closeDialog: function (event) {
			if (event) {
				Event.stop(event);
			}
			/*if (window.browser.isIE6x) {
			 Event.stopObserving(window, "scroll", this.dialog._x_scrollListener);
			 $$("select").each(function(item) {
			 item.style.visibility = item._x_initiallyVisible;
			 });
			 }*/
			// Call optional callback
			this.options.onClose.call(this);
			// Hide the dialog, without removing it from the DOM.
			this.dialog.hide();
			if (this.options.removeOnClose) {
				this.dialog.remove();
			}
			// Stop the UI shortcuts (except the initial Show Dialog one).
			this.detachKeyListeners();
			// Re-enable the 'show' behavior.
			// widgets.ModalPopup.active = false;
			this.active = false;
		},
		/** Enables all the keyboard shortcuts, except the one that opens the dialog, which is already enabled. */
		attachKeyListeners: function () {
			for (var action in this.shortcuts) {
				if (action != "show") {
					this.registerShortcuts(action);
				}
			}
		},
		/** Disables all the keyboard shortcuts, except the one that opens the dialog. */
		detachKeyListeners: function () {
			for (var action in this.shortcuts) {
				if (action != "show") {
					this.unregisterShortcuts(action);
				}
			}
		},
		/**
		 * Enables the keyboard shortcuts for a specific action.
		 *
		 * @param {String} action The action to register
		 * {@see #shortcuts}
		 */
		registerShortcuts: function (action) {
			var shortcuts = this.shortcuts[action].keys;
			var method = this.shortcuts[action].method;
			for (var i = 0; i < shortcuts.size(); ++i) {
				if (Prototype.Browser.IE || Prototype.Browser.WebKit) {
					shortcut.add(shortcuts[i], method.bindAsEventListener(this, action), {type: 'keyup'});
				} else {
					shortcut.add(shortcuts[i], method.bindAsEventListener(this, action), {type: 'keypress'});
				}
			}
		},
		/**
		 * Disables the keyboard shortcuts for a specific action.
		 *
		 * @param {String} action The action to unregister {@see #shortcuts}
		 */
		unregisterShortcuts: function (action) {
			for (var i = 0; i < this.shortcuts[action].keys.size(); ++i) {
				shortcut.remove(this.shortcuts[action].keys[i]);
			}
		},
		createButton: function (type, text, title, id) {
			var wrapper = new Element("span", {"class": "buttonwrapper"});
			var button = new Element("input", {
				"type": type,
				"class": "button",
				"value": text,
				"title": title,
				"id": id
			});
			wrapper.update(button);
			return wrapper;
		},
		show: function (event) {
			this.showDialog(event);
		},
		close: function (event) {
			this.closeDialog(event);
		}
	});
	/** Whether or not the dialog is already active (or activating). */
	widgets.ModalPopup.active = false;
// End PhenoTips augmentation.
	return PhenoTips;
}(PhenoTips || {}));


var PhenoTips = (function (PhenoTips) {
	var widgets = PhenoTips.widgets = PhenoTips.widgets || {};
	widgets.SuggestPicker = Class.create({

		options: {
			'showKey': true,
			'showTooltip': false,
			'showDeleteTool': true,
			'enableSort': true,
			'showClearTool': true,
			'inputType': 'hidden',
			'listInsertionElt': null,
			'listInsertionPosition': 'after',
			'predefinedEntries': null,
			'acceptFreeText': false
		},
		initialize: function (element, suggest, options, serializedDataInput) {
			this.options = Object.extend(Object.clone(this.options), options || { });
			this.serializedDataInput = serializedDataInput;
			this.input = element;
			this.suggest = suggest;
			this.inputName = this.input.name;
			if (!this.options.acceptFreeText) {
				this.input.name = this.input.name + "__suggested";
			} else {
				this.input.addClassName("accept-value");
			}
			this.suggest.options.callback = this.acceptSuggestion.bind(this);
			this.list = new Element('ul', {'class': 'accepted-suggestions'});
			var listInsertionElement;
			if (this.options.listInsertionElt) {
				if (typeof(this.options.listInsertionElt) == "string") {
					listInsertionElement = this.input.up().down(this.options.listInsertionElt);
				} else {
					listInsertionElement = this.options.listInsertionElt;
				}
			}
			if (!listInsertionElement) {
				listInsertionElement = this.input;
			}
			var insertion = {};
			insertion[this.options.listInsertionPosition] = this.list;
			listInsertionElement.insert(insertion);
			this.predefinedEntries = this.options.predefinedEntries ? $(this.options.predefinedEntries) : null;
			if (this.options.showClearTool) {

				//replace by Soheil for GEL(GenomicsEngland), this will help to load messages from localization class
				//this.clearTool = new Element('span', {'class': 'clear-tool delete-tool invisible', 'title': "$services.localization.render('phenotips.widgets.multiSuggest.clear.title')"}).update('Delete all &#x2716;');
				this.clearTool = new Element('span', {'class': 'clear-tool delete-tool invisible', 'title': $services.localization.render('phenotips.widgets.multiSuggest.clear.title')}).update('Delete all &#x2716;');
				this.clearTool.observe('click', this.clearAcceptedList.bindAsEventListener(this));
				this.list.insert({'after': this.clearTool});
			}
			if (typeof(this.options.onItemAdded) == "function") {
				this.onItemAdded = this.options.onItemAdded;
			}
		},

		acceptAddItem: function (key, negative) {
			var searchFor = 'input[id="' + this.getInputId(key, negative).replace(/[^a-zA-Z0-9_-]/g, '\\$&') + '"]';
			var input = this.predefinedEntries ? this.predefinedEntries.down(searchFor) : this.list ? this.list.down(searchFor) : $(this.getInputId(key, negative));
			if (input) {
				input.checked = true;
				Event.fire(input, 'suggest:change');
				//this.ensureVisible(input.up(), true);
				this.synchronizeSelection(input);
				return false;
			}
			return true;
		},

		ensureVisible: function (element, force) {
			if (this.silent || (!force && this.options.silent) || element.up('.hidden')) {
				return;
			}
			var section = element.up('.collapsed:not(.force-collapse)');
			while (section) {
				section.removeClassName('collapsed');
				if (section.down('.expand-tool')) {
					section.down('.expand-tool').update('▼');
				}
				section = section.up('.collapsed:not(.force-collapse)');
			}
			if (element.viewportOffset().top > this.input.viewportOffset().top) {
				if (element.viewportOffset().top > document.viewport.getHeight()) {
					if (element.viewportOffset().top - this.input.viewportOffset().top < document.viewport.getHeight()) {
						this.input.scrollTo();
					} else {
						element.scrollTo();
					}
				}
			} else {
				if (element.cumulativeOffset().top < document.viewport.getScrollOffsets().top) {
					element.scrollTo();
				}
			}
		},

		acceptSuggestion: function (obj) {
			this.input.value = this.input.defaultValue || "";
			if (this.acceptAddItem(obj.id || obj.value, obj.negative)) {
				this.addItem(obj.id || obj.value, obj.value, obj.info, obj.category, obj.valueAll);
			}
			return false;
		},

		addItem: function (key, value, info, category, valueAll) {
			if (!key) {
				return;
			}
			var id = this.getInputId(key);
			var listItem = new Element("li");
			listItem.store("valueAll", valueAll);
			var displayedValue = new Element("label", {"class": "accepted-suggestion", "for": id});
			// insert input
			var inputOptions = {"type": this.options.inputType, "name": this.inputName, "id": id, "value": key};
			if (this.options.inputType == 'checkbox') {
				inputOptions.checked = true;
			}
			displayedValue.insert({'bottom': new Element("input", inputOptions)});
			// if the key should be displayed, insert it
			if (this.options.showKey) {
				displayedValue.insert({'bottom': new Element("span", {"class": "key"}).update("[" + key.escapeHTML() + "]")});
				displayedValue.insert({'bottom': new Element("span", {"class": "sep"}).update(" ")});
			}
			// insert the displayed value
			displayedValue.insert({'bottom': new Element("span", {"class": "value"}).update(value.escapeHTML())});


			//********************************************************************************************************
			//Added by Soheil for GEL(GenomicsEngland)
			//customizeItemDisplay is a function that is passed to the options of the suggest
			//if it exists, it will be called and it will customize the display item like adding type of disorder to
			//found disorder list and ......
			if(this.options.customizeItemDisplay != undefined && typeof this.options.customizeItemDisplay === "function"){
				this.options.customizeItemDisplay(key, value, valueAll, displayedValue,this.options);
			}
			//********************************************************************************************************


			listItem.insert(displayedValue);
			if (category && category != '') {
				listItem.insert(category);
			}
			// delete tool
			if (this.options.showDeleteTool) {
				var deleteTool = new Element("span", {'class': "delete-tool", "title": "Delete this term"}).update('&#x2716;');
				deleteTool.observe('click', this.removeItem.bindAsEventListener(this));
				listItem.appendChild(deleteTool);
			}
			// tooltip, if information exists and the options state there should be a tooltip
			if (this.options.showTooltip && info) {
				listItem.appendChild(new Element("div", {'class': "tooltip"}).update(info));
				listItem.select('.expand-tool').invoke('observe', 'click', function (event) {
					event.stop();
				});
			}
			this.list.insert(listItem);
			var newItem = this.list ? this.list.down('input[id="' + id.replace(/[^a-zA-Z0-9_-]/g, '\\$&') + '"]') : $(id);
			//this.ensureVisible(newItem);
			this.synchronizeSelection(newItem);
			newItem.observe('change', this.synchronizeSelection.bind(this, newItem));
			this.updateListTools();
			this.onItemAdded(newItem)
			return newItem;
		},

		onItemAdded: function (element) {
		},

		removeItem: function (event) {
			var item = event.findElement('li');
			this.synchronizeSelection({
				value: (item.down('input[type=checkbox]') || item.down('input')).value,
				checked: false
			});
			item.remove();
			this.notifySelectionChange(item);
			this.input.value = this.input.defaultValue || "";
			this.updateListTools();
		},

		clearAcceptedList: function () {
			// The list items are recreated after each update, so we can't cache the set of items, we must request them one by one
			var item = this.list.down('li .delete-tool');
			while (item) {
				item.click();
				item = this.list.down('li .delete-tool');
			}
		},

		updateListTools: function () {
			if (this.clearTool) {
				if (this.list.select('li .accepted-suggestion').length > 0) {
					this.clearTool.removeClassName('invisible');
				} else {
					this.clearTool.addClassName('invisible');
				}
			}
			if (this.options.enableSort && this.list.select('li .accepted-suggestion').length > 0 && typeof(Sortable) != "undefined") {
				Sortable.create(this.list);
			}
			if (this.serializedDataInput) {
				var value = '';
				this.list.select('li .accepted-suggestion input[type=checkbox]').each(function (entry) {
					value += entry.value + '|';
				});
				this.serializedDataInput.value = value;
			}
		},

		getInputId: function (key, negative) {
			return (negative ? this.inputName.replace(/(_\d+)_/, "$1_negative_") : this.inputName) + "_" + key;
		},

		synchronizeSelection: function (input) {
			var element = (typeof (input.up) == 'function') && input.up('li');
			if (element) {
				if (this.input.hasClassName('generateYesNo') && !input.up('.yes-no-picker')) {
					Element.select(element, 'input[name="fieldName"][type="hidden"]').each(function (n) {
						var target = n.up('li').down('input[type="checkbox"]');
						var originalName = target.name;
						target.id = target.id.replace(target.name, n.value);
						target.name = n.value;
						target.up('label').addClassName(n.className);
						target.up('label').htmlFor = target.id;
						n.value = originalName;
						if (n.up('.term-category')) {
							n.up('.term-category').insert({before: n});
						}
					});
					var positiveName = this.input.name.replace(/__suggested$/, "");
					var negativeName = this.input.name.replace(/(_\d+)_/, "$1_negative_").replace(/__suggested$/, "");
					;
					var value = input.value;
					var text = element.down('.value').firstChild.nodeValue;
					var ynpickerElt = YesNoPicker.generatePickerElement([
						{type: 'na', selected: !isValueSelected(positiveName, value) && !isValueSelected(negativeName, value)},
						{type: 'yes', name: positiveName, selected: isValueSelected(positiveName, value)},
						{type: 'no', name: negativeName, selected: isValueSelected(negativeName, value)}
					], value, text, true, input.next());
					input.insert({before: ynpickerElt});
					input.hide();
					input.name = '';
					input.id = '';
					input.value = '';
					enableHighlightChecked(ynpickerElt.down('.yes input'));
					enableHighlightChecked(ynpickerElt.down('.no input'));
				}
			}
			if (element) {
				this.notifySelectionChange(element);
			}
		},

		notifySelectionChange: function (elt) {
			if (!elt.__categoryArray) {
				elt.__categoryArray = [];
				Element.select(elt, '.term-category input[type=hidden]').each(function (c) {
					elt.__categoryArray.push(c.value);
				});
			}
			Event.fire(this.input, 'xwiki:form:field-value-changed');
			Event.fire(document, "custom:selection:changed", {
				'categories': elt.__categoryArray,
				'trigger': this.input,
				'fieldName': this.inputName,
				'customElement': elt
			});
		}
	});
	return PhenoTips;
}(PhenoTips || {}));