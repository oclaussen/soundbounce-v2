/**
 * Created by paulbarrass on 01/11/2017.
 */

import React, {Component, PropTypes} from 'react';
import {Mesh, Object3D, PerspectiveCamera, Renderer, Scene} from 'react-three';
import * as THREE from 'expose?THREE!three';

import moment from 'moment';
import Proton from 'three.proton.js';
import theme from './blocks.css';
import NoteExtractor from './NoteExtractor';

const railColors = ['#FA0B84', '#00BFFF', '#f57c00', '#b2ff59'];
const railKeys = ['h', 'j', 'k', 'l'];
const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
const simpleWhiteMaterial = new THREE.MeshBasicMaterial({});
const simpleRedMaterial = new THREE.MeshBasicMaterial({
	color: 0xff0000, transparent: true, opacity: 0.7
});
const finishedSegmentMaterials = railColors.map(color => (new THREE.MeshBasicMaterial({
	color: parseInt(`0x${color.substr(1)}`),
	transparent: true,
	opacity: 0.4
})));
const yStretch = 25;
const numRails = 4;
const minGap = 12;

export default class MusicBlocks3D extends Component {
	static propTypes = {
		width: PropTypes.number.isRequired,
		height: PropTypes.number.isRequired,
		analysis: PropTypes.object.isRequired,
		player: PropTypes.object
	};

	constructor(props) {
		super(props);
		this.state = {time: 0, score: 0};
		this.clock = new THREE.Clock();

		// super basic material cache
		this.materialCache = {};
		this.colorIndex = 0;
		this.railButtons = [false, false, false, false];
		this.railHasActiveNote = [false, false, false, false];
		this.railStatus = [null, null, null, null];
		this.noteStatus = [];

		this.getMaterial = (key) => {
			if (this.materialCache[key]) {
				return this.materialCache[key];
			}
			const material = new THREE.MeshBasicMaterial({
				color: parseInt(`0x${railColors[key % railColors.length].substr(1)}`)
			});
			this.materialCache[key] = material;
			this.colorIndex++;
			return material;
		};
	}

	animate = () => {
		const {player} = this.props;
		if (!this.mounted) {
			return;
		}
		this.frameId = requestAnimationFrame(this.animate);

		// update scores
		const oldScore = this.state.score;
		let newScore = oldScore;
		// use clock delta so score is framerate independent
		const delta = this.clock.getDelta();

		for (let rail = 0; rail < numRails; rail++) {
			if (!this.railHasActiveNote[rail] && this.railButtons[rail]) {
				// pressing the note when they shouldn't be
				this.railStatus[rail] = 'losing';
			}
			if (this.railStatus[rail] === 'scoring') {
				newScore += Math.ceil(delta * 10000);
			}
			if (this.railStatus[rail] === 'losing') {
				newScore -= Math.ceil(delta * 6000);
			}
		}
		let scoreDirection = newScore === oldScore ? 'Same' : newScore > oldScore ? 'Rising' : 'Falling';

		if (newScore < 0) {
			newScore = 0;
			scoreDirection = 'Falling';
		}

		let requestTime = 150; // player.updateArrivedAt - player.updateRequestedAt;

		this.setState({
			score: newScore,
			scoreDirection,
			time: player.is_playing
				? (player.progress_ms + (moment().valueOf() - player.updateArrivedAt - (requestTime / 2))) / 1000 : 0
			//		? (player.progress_ms + (moment().valueOf() - player.timestamp)) / 1000 : 0
		})
		;
	};

	componentDidMount() {
		this.mounted = true;
		this.animate();
		console.log(this.props.analysis);

		document.addEventListener('keydown', this.onKeyDown);
		document.addEventListener('keyup', this.onKeyUp);
	}

	componentWillUnmount() {
		this.mounted = false;
		document.removeEventListener('keydown', this.onKeyDown);
		document.removeEventListener('keyup', this.onKeyUp);
	}

	onKeyDown = evt => {
		const railIndex = railKeys.indexOf(evt.key);
		if (railIndex > -1) {
			this.railButtons[railIndex] = true;
		}
	};

	onKeyUp = evt => {
		const railIndex = railKeys.indexOf(evt.key);
		if (railIndex > -1) {
			this.railButtons[railIndex] = false;
		}
	};

	createSprite() {
		const map = new THREE.TextureLoader().load(require('!!file?limit=0!./smokeparticle.png'));
		const material = new THREE.SpriteMaterial({
			map: map,
			color: 0xff0000,
			blending: THREE.AdditiveBlending,
			fog: true
		});
		return new THREE.Sprite(material);
	}

	createEmitter(rail, isFail, isSpark) {
		const emitter = new Proton.Emitter();
		emitter.rate = new Proton.Rate(new Proton.Span(10, 15), new Proton.Span(0.05, 0.1));
		emitter.addInitialize(new Proton.Body(this.createSprite()));
		emitter.addInitialize(new Proton.Mass(isFail ? 2.5 : 1));
		emitter.addInitialize(new Proton.Life(1, 3));
		emitter.addInitialize(new Proton.Position(new Proton.SphereZone(30)));
		if (isSpark) {
			emitter.addInitialize(new Proton.V(new Proton.Span(20, 100), new Proton.Vector3D(0, 1, 0), 30));
		} else {
			emitter.addInitialize(new Proton.V(new Proton.Span(100, isFail ? 200 : 400), new Proton.Vector3D(0, 1, 0), 30));
		}

		if (isFail) {
			emitter.addBehaviour(new Proton.RandomDrift(5, 5, 5, 0.02));
		} else {
			emitter.addBehaviour(new Proton.RandomDrift(10, 10, 10, 0.05));
		}
		emitter.addBehaviour(new Proton.Alpha(1, 0.1));
		if (isSpark) {
			emitter.addBehaviour(new Proton.Scale(new Proton.Span(0.5, 0.7), 0));
		} else {
			if (isFail) {
				emitter.addBehaviour(new Proton.Scale(new Proton.Span(0.5, 0.6), 0));
			} else {
				emitter.addBehaviour(new Proton.Scale(new Proton.Span(0.5, 1.4), 0));
			}
		}
		emitter.addBehaviour(new Proton.G(9.8));
		emitter.addBehaviour(new Proton.Color(isFail ? '#FF0026' : (isSpark ? '#ffffff' : railColors[rail]),
			['#ffff00', '#ffffcc'], Infinity, Proton.easeOutSine));
		emitter.p.x = rail * (120 / numRails);
		emitter.p.y = 0;
		return emitter;
	}

	initParticles = scene => {
		// starfield bg
		const geometry = new THREE.Geometry();
		for (let i = 0; i < this.props.analysis.track.duration * 5; i++) {
			const vertex = new THREE.Vector3();
			vertex.x = Math.random() * 2000 - 1000;
			vertex.y = Math.random() * (this.props.analysis.track.duration + 50) * yStretch - 200;
			vertex.z = Math.random() * -2000 - 50;
			geometry.vertices.push(vertex);
		}

		this.stars = new THREE.Points(geometry,
			new THREE.PointsMaterial({size: 3, color: 0x00BFFF, fog: false})
		);
		scene.add(this.stars);

		// this fog makes the notes appear to fade in at top of camera
		scene.fog = new THREE.Fog(0, 180, 240);

		// physics engine to emit particles
		this.proton = new Proton();
		this.successEmitters = [];
		this.sparkEmitters = [];
		this.failEmitters = [];
		for (let railIndex = 0; railIndex < numRails; railIndex++) {
			this.failEmitters[railIndex] = this.createEmitter(railIndex, true);
			this.successEmitters[railIndex] = this.createEmitter(railIndex);
			this.sparkEmitters[railIndex] = this.createEmitter(railIndex, false, true);
			this.proton.addEmitter(this.failEmitters[railIndex]);
			this.proton.addEmitter(this.successEmitters[railIndex]);
			this.proton.addEmitter(this.sparkEmitters[railIndex]);
		}

		this.proton.addRender(new Proton.SpriteRender(scene));
		this.particlesReady = true;
	};

	enableEmitter(emitter, enable) {
		if (enable && emitter.totalEmitTimes === -1) {
			// it's off and we've been asked to enable
			emitter.emit();
		}
		if (!enable && emitter.totalEmitTimes > -1) {
			emitter.stopEmit();
		}
	}

	customRender = (renderer, scene, camera) => {
		if (!this.particlesReady) {
			this.initParticles(scene);
		}

		for (let railIndex = 0; railIndex < numRails; railIndex++) {
			// move all the emitters along with the music
			this.successEmitters[railIndex].p.y = this.state.time * yStretch;
			this.failEmitters[railIndex].p.y = this.state.time * yStretch;
			this.sparkEmitters[railIndex].p.y = this.state.time * yStretch;

			// check if rail has segment active and if key / button is pushed:
			if (this.railHasActiveNote[railIndex]) {
				if (this.railButtons[railIndex]) {
					// button is down, and it's supposed to be
					this.enableEmitter(this.successEmitters[railIndex], true);
					this.enableEmitter(this.sparkEmitters[railIndex], true);
					this.enableEmitter(this.failEmitters[railIndex], false);
				} else {
					// button isn't down, and it's supposed to be
					this.enableEmitter(this.successEmitters[railIndex], false);
					this.enableEmitter(this.sparkEmitters[railIndex], false);
					this.enableEmitter(this.failEmitters[railIndex], true);
				}
			} else {
				if (this.railButtons[railIndex]) {
					// pushing when shouldn't
					this.enableEmitter(this.successEmitters[railIndex], false);
					this.enableEmitter(this.sparkEmitters[railIndex], false);
					this.enableEmitter(this.failEmitters[railIndex], true);
				} else {
					// no active note, no keys pressed, so all emitters off
					this.enableEmitter(this.successEmitters[railIndex], false);
					this.enableEmitter(this.sparkEmitters[railIndex], false);
					this.enableEmitter(this.failEmitters[railIndex], false);
				}
			}
		}

		this.proton.update();
		renderer.render(scene, camera);
//		Proton.Debug.renderInfo(this.proton, 3);
	};

	render() {
		const {
			width, height, analysis, player
		} = this.props;

		const yTrackPosition = this.state.time * yStretch;

		const yMin = yTrackPosition - 100;
		const yMax = yTrackPosition + 300;
		const cameraProps = {
			fov: 85, aspect: width / height,
			near: 1, far: 5000,
			position: new THREE.Vector3(50, yTrackPosition, 120),
			lookat: new THREE.Vector3(50, yTrackPosition + 55, 0)
		};

		// todo: avoid this every frame, do this only on track change for perf increase!
		const notes = NoteExtractor.extractNotes(analysis);
		const noteMeshes = [];
		const railSegmentEnds = [];

		// this is a bit naughty and a react anti-pattern, mutating this component's hidden
		// state during render (we pick these values up during this.animate).
		// would never do this in 'normal' code but this render
		// is hit literally every single frame anyway
		// so is actually better than firing extra state changes
		this.railHasActiveNote = [false, false, false, false];
		this.railStatus = [null, null, null, null];

		let segmentId = 0;
		notes.forEach((note, noteIndex) => {
			//	const timbreForPitch = segment.timbre[pitchIndex];
			const yScale = Math.max(note.duration * yStretch / 10, 0.4);
			const segmentWidth = 0.01 + (0.016 * (40 + note.loudness));
			const railForThisSegment = note.rail;
			const xPos = (railForThisSegment) * (120 / numRails);
			const yPos = note.start * yStretch + (yScale * 5);

			// store the end point of this segment on this rail, plus the minimum gap we want
			// between notes on a single rail
			railSegmentEnds[railForThisSegment] = yPos + yScale * 10 + minGap;

			// work out if this note is currently active
			const segmentIsActive = (yPos - (yScale * 5)) < yTrackPosition &&
				(yPos + (yScale * 5)) > yTrackPosition;

			// pick a material based on state
			let material = (yPos + (yScale * 5)) > yTrackPosition
				? this.getMaterial(railForThisSegment)
				: (this.noteStatus[segmentId]
					? finishedSegmentMaterials[railForThisSegment]
					: simpleRedMaterial);

			if (segmentIsActive) {
				this.railHasActiveNote[railForThisSegment] = true;
				if (this.railButtons[railForThisSegment] || this.noteStatus[segmentId]) {
					this.railStatus[railForThisSegment] = 'scoring';
					this.noteStatus[segmentId] = true;
					material = simpleWhiteMaterial;
				} else {
					// supposed to be pressing key but not, so make segment red
					material = simpleRedMaterial;
					this.railStatus[railForThisSegment] = 'losing';
				}
			}

			segmentId++;
			if (railSegmentEnds[railForThisSegment] > yMin && yPos < yMax) {
				noteMeshes.push(
					<Mesh key={noteIndex}
						  geometry={boxGeometry}
						  material={material}
						  scale={new THREE.Vector3(
							  Math.min(segmentWidth, 1) * ((120 / numRails) / 10),
							  yScale,
							  material === segmentIsActive ? 1 : 0.1
						  )}
						  position={new THREE.Vector3(xPos, yPos, 0)}
					/>
				);
			}
		});

		return (
			<div>
				<div className={theme[`score${this.state.scoreDirection}`]}>
					{this.state.score.toLocaleString(navigator.language,
						{minimumFractionDigits: 0}
					)}
				</div>
				<div className={theme.title}>
					{player.item.name}
				</div>
				<div className={theme.keys}>
					{railKeys.map((key, index) => (
						<div
							className={this.railButtons[index]
								? theme.keyPressed : this.railHasActiveNote[index]
									? theme.keyShouldPress : theme.key}
							key={index}>
							<div className={theme.keycap}
								 style={{
									 color: (!this.railButtons[index] &&
									 this.railHasActiveNote[index])
										 ? 'red' : railColors[index]
								 }}>{key}</div>
						</div>
					))}
				</div>
				<div className={theme.threeContainer}>
					<Renderer width={width} height={height}
							  enableRapidRender={true}
							  transparent={true}
							  customRender={this.customRender}>
						<Scene width={width} height={height} camera="maincamera">
							<PerspectiveCamera name="maincamera" {...cameraProps} />
							{ /*
							 hit line
							 <Mesh geometry={boxGeometry}
							 material={simpleWhiteMaterial}
							 scale={new THREE.Vector3(200, 0.05, 0.01)}
							 position={new THREE.Vector3(-100, yTrackPosition, 0)}
							 />
							 */ }
							{analysis.bars.map(bar => (
								bar.start * yStretch > yMin && bar.start * yStretch < yMax &&
								<Mesh geometry={boxGeometry}
									  key={bar.start}
									  material={simpleWhiteMaterial}
									  scale={new THREE.Vector3(12, 0.01, 0.01)}
									  position={new THREE.Vector3(50, bar.start * yStretch, 0)}/>
							))}
							<Object3D>
								{noteMeshes}
							</Object3D>
						</Scene>
					</Renderer>
				</div>
			</div>
		);
	}
}

