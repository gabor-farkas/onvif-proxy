var
  http = require('http'),
  Cam = require('onvif').Cam;
  fs = require('fs');

const util = require("node:util");
const execFile = util.promisify(require("node:child_process").execFile);

const videoSavingDescriptors = [
	{
		rtspAddress: 'rtsp://192.168.201.6:8554/padlas',
		onvifAddress: '192.168.1.101',
		filePostfix: 'padlas'
	},
	{
		rtspAddress: 'rtsp://192.168.201.6:8554/kulso',
		onvifAddress: '192.168.1.100',
		filePostfix: 'korbenezo'
	}
];

function videoSaver(desc) {
	let videorunning = false;
	let videos = [];
	let keepUntil = null;
	
	async function startVideoSaving() {
		if (videorunning) {
			console.log('Recording already running');
			return;
		}
		videorunning = true;
		const start = new Date();
		const timestamp = Math.floor(start.getTime() / 1000);
		const fileName = timestamp + '-' + desc.filePostfix + '.mp4';
		const tmpPath = '/mnt/ramdisk' + fileName; // in fstab: "tmpfs /mnt/ramdisk tmpfs nodev,nosuid,size=10M 0 0"
		const finalPath = '../recordings/' + fileName;
		videos.push({ name: fileName, start, tmpPath, finalPath });
		console.log('Starting recording ' + start);
		await execFile("ffmpeg", ['-i', desc.rtspAddress, '-c:a', 'aac', '-vcodec', 'copy', '-t', '15', tmpPath]);
		videorunning = false;
		console.log('Recording finished ' + start);
		setTimeout(startVideoSaving, 0);
		// delete videos older than 30s
		const keep = [];
		videos.forEach(v => {
			const now = new Date().getTime();
			if (now - v.start.getTime() > 30 * 1000) {
				if (keepUntil && (v.start.getTime() < keepUntil )) { 
					console.log('Preserving video ' +  v.name);
					fs.rename(v.tmpPath, v.finalPath, () => {
						console.log('Done');
					});
				} else {
					fs.unlink(v.name, () => {
						console.log('Deleted old video ' + v.name)
					});
				}
			} else keep.push(v);
		});
		videos = keep;
	}
	
	const cam = new Cam({
	  hostname: desc.onvifAddress,
	  port: 2020,
	  username: 'qwe123',
	  password: 'qwe123'
	}, function(err) {
		cam.connect(x => {
		startVideoSaving();
			//cam.getServiceCapabilities(console.log);
			//cam.getDeviceInformation(console.log);
			//cam.getCapabilities(console.log);
		//cam.getProfiles((a,x) => console.log(JSON.stringify(x, 0, 4)));
		//cam.getStreamUri({protocol:'RTSP', profileToken: 'profile_2'}, (err, stream) => { console.log(stream); });
			//console.log(cam.getEventProperties((_,x) => console.log(JSON.stringify(x, 0, 4))));
			
			cam.on('event', (msg, xml) => {
				console.log(JSON.stringify(msg, 0, 4));
			keepUntil = new Date().getTime() + 5 * 1000;
			startVideoSaving(); // ensure video saving process is ongoing, at least now
			});
			
		   //cam.relativeMove({x: 1});
			console.log('listening ' + desc.filePostfix);
		})
	});		
}

videoSavingDescriptors.forEach(videoSaver);

