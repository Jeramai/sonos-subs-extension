const fs = require('fs');

// Build for Firefox
function buildFirefox() {
  console.log('Building for Firefox...');

  // Convert Chrome manifest to Firefox format
  const chromeManifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const firefoxManifest = {
    ...chromeManifest,
    manifest_version: 2,
    browser_action: chromeManifest.action,
    background: {
      scripts: ['background.js'],
      persistent: false
    },
    web_accessible_resources: chromeManifest.web_accessible_resources[0].resources,
    browser_specific_settings: {
      gecko: {
        id: "sonos-subs@jeram.ai"
      }
    }
  };

  delete firefoxManifest.action;
  delete firefoxManifest.host_permissions;

  firefoxManifest.permissions.push('https://lrclib.net/*');

  fs.writeFileSync('dist-firefox/manifest.json', JSON.stringify(firefoxManifest, null, 2));

  // Copy all other files
  const filesToCopy = [
    'patch.js', 'popup.html', 'popup.css', 'popup.js', '10-seconds-of-silence.mp3'
  ];

  // Copy files
  fs.copyFileSync('background.js', 'dist-firefox/background.js');
  fs.copyFileSync('content.js', 'dist-firefox/content.js');

  filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, `dist-firefox/${file}`);
    }
  });

  // Copy icons directory
  if (fs.existsSync('icons')) {
    fs.mkdirSync('dist-firefox/icons', { recursive: true });
    fs.readdirSync('icons').forEach(icon => {
      fs.copyFileSync(`icons/${icon}`, `dist-firefox/icons/${icon}`);
    });
  }
}

// Create directories
if (!fs.existsSync('dist-firefox')) {
  fs.mkdirSync('dist-firefox', { recursive: true });
}

buildFirefox();
console.log('Firefox build complete!');
