/* Widget Definitions */

// This defines the <widget> tag which is created for every piece of content.
app.directive('widget', function($sce) {
	return {
		restrict: 'E',
		replace: true,
		// TODO Move to templateUrl
		template: '<span id="{{id}}" class="ui-widget-content" ' +
			'ng-style="{ top: item.y, left: item.x, width: item.width, ' +
			'height: item.height, \'z-index\': item.z }"></span>',
		link: function(scope, elem, attrs) {
			app._setupWidget(scope, elem, $sce);
			app._setupWidgetEvents(scope, elem);
		}
	};
});

app._widgetRegistrations = {};

app._registerWidget = function(type, f) {
	app._widgetRegistrations[type] = f;
}

app._setupWidget = function(scope, elem, $sce) {
	scope.$parent.maxZ = Math.max(scope.$parent.maxZ, scope.item.z);

	elem.css("z-index", scope.item.z);
	elem.append('<span class="close">&times;</span>')
	elem.append('<h3>'+(scope.item.name || scope.item.type)+'</h3>');

	if (app._widgetRegistrations[scope.item.type]) {
		app._widgetRegistrations[scope.item.type](scope,elem,$sce);
	}
	else {
		app._widgetRegistrations["iframe"](scope,elem,$sce);	
	}
};


// Add the events to the widget to make it active.
app._setupWidgetEvents = function(scope,elem) {
	elem.children('.close').click(function(e) { 
		e.stopPropagation();
		scope.$parent.items.$remove(scope.id);
	});

	elem.draggable({
			start: function(event, ui) {
			$(this).addClass('dragging').children('.overlay').show();
		},
		
		stop: function(event, ui) {
				$(this).removeClass('dragging').children('.overlay').hide();

  				scope.$apply(function read() {
					scope.item.x = elem.css('left');
					scope.item.y = elem.css('top');
					scope.item.z = elem.css('z-index');
					scope.$parent.items.$save(scope.id);
				})
			}
		})
	.resizable({
  		start: function(event, ui) {
			$(this).addClass('resizing').children('.overlay').show();
		},
		resize: function(event,ui) {
				$(this).children('.overlay').show();
		},
		stop: function(event, ui) {
			$(this).removeClass('resizing').children('.overlay').hide();;

				scope.$apply(function() {
					scope.item.width = elem.css('width');
					scope.item.height = elem.css('height');
  					scope.$parent.items.$save(scope.id);
				})
			}
	})
	.hover(
  		function() { $(this).addClass('hover'); }, 
			function() { $(this).removeClass('hover'); }
	)
	.click(
		function() {
			scope.item.z = ++scope.$parent.maxZ;
			scope.$parent.items.$save(scope.id);
		}
	);
}
