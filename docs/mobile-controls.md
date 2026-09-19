# Mobile controls and steering

The touch redesign follows Apple's guidance to put frequent actions near the thumbs, keep the center clear, use comfortable touch targets, combine related actions, and provide visible pressed states. See [Design advanced games for Apple platforms, WWDC24](https://developer.apple.com/videos/play/wwdc2024/10085/) (Design for input) and [Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls).

Implementation choices for this racer: automatic acceleration removes the held throttle button; steering occupies the left thumb zone; boost and combined brake/drift occupy the right thumb zone. Holding brake while steering initiates a drift and applies gentler braking. Releasing brake resumes acceleration. Keyboard driving disables touch auto acceleration until the next touch; a connected gamepad uses its own throttle. Recovery is in Pause instead of occupying the driving surface. The HUD prioritizes time, lap, speed, ghost gap, and boost availability.

The track frame's `right` vector is the driver's screen-left when viewed from the chase camera: the camera looks along positive track forward, while Three.js cameras look down local negative Z. Player input is negated once at the input boundary for touch, keyboard, and gamepad. AI physics inputs, track geometry, and saved replay coordinates keep their existing convention. Tests must verify world movement against the camera's right axis, not just assert that a button returns a positive input number.

The home screen on touch devices provides a circuit selector, one large Play button, and secondary menu links. Fullscreen remains mandatory. Touch controls stay inside safe areas and allow sliding between the steering buttons without lifting the thumb. A neutral strip at the center releases steering while retaining capture.

Validation uses Chromium touch emulation and camera-space direction assertions. This does not establish comfort or performance on all physical phones; real-device feedback remains valuable.
