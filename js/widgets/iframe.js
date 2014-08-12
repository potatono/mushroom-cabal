app._registerWidget("iframe", function(scope, elem, $sce) {
	var url = $sce.trustAsResourceUrl(scope.item.url);
	elem.append('<div class="overlay" />');
	elem.append('<iframe class="content" src="' + url + 
		'" frameborder="0"></iframe>');
});
