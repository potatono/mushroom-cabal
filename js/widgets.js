/* Widget Definitions */

// This defines the <widget> tag which is created for every piece of content.
app.directive('widget', function($sce) {
	return {
		restrict: 'E',
		replace: true,
		// TODO Move to templateUrl
		template: '<div id="{{id}}" class="widget"></div></div>',
		link: function(scope, elem, attrs) {
			app._setupWidget(scope, elem, $sce);
		}
	};
});

app._widgetRegistrations = {};

app._registerWidget = function(type, f) {
	app._widgetRegistrations[type] = f;
}

app._setupWidget = function(scope, elem, $sce) {
	scope.$parent.maxZ = Math.max(scope.$parent.maxZ, scope.item.z);

	elem.append('<img src="'+scope.item.avatar+'" class="avatar" />');
	elem.append('<h3>'+scope.item.from+'</h3>')

	elem.append('<div class="content"></div>');

	var innerElem = elem.children('.content');

	if (app._widgetRegistrations[scope.item.type]) {
		app._widgetRegistrations[scope.item.type](scope,innerElem,$sce);
	}
	else {
		app._widgetRegistrations["iframe"](scope,innerElem,$sce);	
	}

	if (scope.item.description)
		elem.append('<div class="description">'+ scope.item.description +'</div>');
};
