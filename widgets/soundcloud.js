 // TODO FIXME REFACTOR This is a mess.
 app._registerWidget("soundcloud", function(scope,elem,$sce) {
 	// Get embed code from url using oembed.  Yay oembed!
	$.getJSON("http://soundcloud.com/oembed?url="+escape(scope.item.url),
		function(data, status, jqxhr) {
			// Get url from iframe in data.html, handle appropriate flags and append
			var url = data.html.replace(/.*src="(.+?)".*/,"$1");

			if (scope.item.flags && scope.item.flags.indexOf("+start")>=0) {
				url += "&auto_play=true";
			}

			elem.append('<div class="overlay" />');
			elem.append('<iframe id="'+scope.id+'_player" src="'+url+
				'" frameborder="0"></iframe>');

			if (elem.children('h3').text() == "soundcloud" && data.title)
				elem.children('h3').text(data.title);


			// Initialize the SoundCloud API
			var player = SC.Widget(scope.id+"_player");
			player.currentIndex = 0;

			// Wait for the player to be ready before we start setting things up.
			player.bind(SC.Widget.Events.READY, function() {

				// Save the current sound index so we can detect changes
				player.getCurrentSoundIndex(function(idx) { player.currentIndex = idx; });

				// Play and pause code are almost identical so we'll use a generator to
				// avoid repeating outselves.
				function playPauseHandler(isPlay) {
					return function(e) {
						// Player likes to throw events like crazy so we debounce 
						if (!player.debounce) {
							console.log(isPlay ? "PLAY" : "PAUSE");

							// Check to see if we're actually on a new track
							player.getCurrentSoundIndex(function(idx) {
								if (player.currentIndex != idx) {
									console.log("Index changed to " + idx);

									player.currentIndex = idx;
									scope.$apply(function() {
										scope.item.index = idx;
										scope.item.position = 0;
										scope.$parent.items.$save(scope.id);
										player.seekTo(0);
									});
								}
								// Otherwise send the play event on
								else {
									scope.$apply(function() {
										scope.item.active = isPlay;
										scope.$parent.items.$save(scope.id);
									});
								}
							});
						}
					}
				}

				// Bind our handler to PLAY and PAUSE
				player.bind(SC.Widget.Events.PLAY, playPauseHandler(true));
				player.bind(SC.Widget.Events.PAUSE, playPauseHandler(false));

				// Watch for FINISH so we can honor +loop
				player.bind(SC.Widget.Events.FINISH, function() {
					console.log("FINISH");
					if (scope.item.flags && scope.item.flags.indexOf("+loop")>=0) {
						player.play();
					}
				});

				// Watch for SEEK
				player.bind(SC.Widget.Events.SEEK, function(e) {
					var pos = e.currentPosition / 1000.0;

					console.log("SEEK to " + pos);
					scope.$apply(function() {
						scope.item.position = pos;
						scope.$parent.items.$save(scope.id);
					});
				});

				// Honor +mute
				if (scope.item.flags && scope.item.flags.indexOf("+mute")>=0)
					player.setVolume(0);

				// Set up our watcher for active state changes
				scope.$watch("item.active", function() {
					// We check to see if the player is already in the state
					// we're sending to prevent event loops.  We also add
					// a debouncer since the player is event noisy.
					player.isPaused(function (isPaused) {
						if (isPaused && scope.item.active) {
							console.log("Sending play");
							player.debounce = true;
							player.play();
							window.setTimeout(function() { player.debounce = false; }, 100);
						}
						else if (!isPaused && !scope.item.active) {
							console.log("Sending pause");
							player.debounce = true;
							player.pause();
							window.setTimeout(function() { player.debounce = false; }, 100);
						}
					});
				});

				// Set up our watcher for seek changes.  Require a +/- 5s change to prevent
				// bouncing
				scope.$watch("item.position", function() {
					player.getPosition(function(pos) {
						if (Math.abs(scope.item.position - pos/1000)>5) {
							console.log("Sending seek");
							player.seekTo(scope.item.position*1000, true);		
						}
					});				
				});

				// Set up our watcher for index changes.
				scope.$watch("item.index", function() {
					player.getCurrentSoundIndex(function(idx) {
						if (idx != scope.item.index) {
							console.log("Sending skip");
							player.currentIndex = scope.item.index;
							player.skip(scope.item.index);
						}
					})
				})
			});
		}
	);
});

