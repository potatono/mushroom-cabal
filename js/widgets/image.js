app._registerWidget("image",function(scope, elem, $sce) {
	var url = $sce.trustAsResourceUrl(scope.item.url);

	elem.append('<img src="' + url + '" />');

	if (!scope.item.width && !scope.item.height) {
		elem.children('img').addClass("loading").load(function() { 
			scope.item.width = $(this).width() + "px";
			scope.item.height = ($(this).height() + 25) + "px";
			scope.$parent.items.$save(scope.id);
			$(this).removeClass("loading");
		});	
	}
});
