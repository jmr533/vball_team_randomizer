const path = require('path');
const sharp = require('sharp');

const source = path.join(__dirname, '..', 'assets', 'android', 'icon.png');
const resourceRoot = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const densities = ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

async function generateAdaptiveIconLayers() {
  await Promise.all(
    densities.map(async (density) => {
      const directory = path.join(resourceRoot, `mipmap-${density}`);
      const foreground = path.join(directory, 'ic_launcher_foreground.png');
      const background = path.join(directory, 'ic_launcher_background.png');
      const { width, height } = await sharp(foreground).metadata();
      await sharp(source)
        .resize(width, height)
        .png()
        .toFile(foreground);
      await sharp({
        create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .png()
        .toFile(background);
    })
  );
}

generateAdaptiveIconLayers().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
