class Glitcher {
  constructor(img) {
    this.channelLen = 4;
    this.img = img;
    this.img.loadPixels();
    this.flowLines = [ {
      pixels: null,
      y: floor(random(1000)),
      speed: floor(random(4, 24)),
      randX: floor(random(24, 80)),
    } ];
    this.shiftLineImg = null;
    this.holdShiftLine = false;
    this.shiftLineImgs = new Array(6).fill(null);
    this.scatImgs = new Array(3).fill({ img: null, x: 0, y: 0 });
    this.originalImg = new Uint8ClampedArray(this.img.pixels);
    this.sortConfigs = new Array(this.img.height).fill(0).map(_ => ({
      position: floor(random(this.img.width)),
      speed: floor(random(-10, 10) || 2),
      reverse: random(2) > 1,
    }));
    this.holdShiftedImg = false;
    this.shiftedImg = null;
  }

  reset() {
    if (this.holdShiftLine && this.shiftLineImg) {
      ImgUtil.copyPixels(this.shiftLineImg, this.img);
      if (random(100) > 50) this.glitchShiftLine(random(200));
    } else if (this.holdShiftedImg && this.shiftedImg) {
      ImgUtil.copyPixels(this.shiftedImg, this.img);
    } else {
      ImgUtil.copyPixels(this.originalImg, this.img);
    }
  }

  // pixelIndex wrapper for use with this.img
  pixelIndex(x, y) {
    return ImgUtil.pixelIndex(x, y, this.img);
  }

  ///////////////////////
  // FLOW LINE
  ///////////////////////
  // usage: adding oldtimy thin black line that loops down screen
  // simply adds a thin horizontal black line across img based on config obj
  // config = { pixels, y, speed, randX }
  flowLine(config) {
    const srcImg = this.img;
    const destPixels = new Uint8ClampedArray(srcImg.pixels);
    config.y %= srcImg.height;
    config.y += config.speed;
    let tempY = floor(config.y);

    ImgUtil.forEachPixel(srcImg, rgba => rgba.forEach((i, idx) => {
      destPixels[i] = srcImg.pixels[i] + (idx < 3) ? config.randX : 0;
    }), y => tempY === y);

    return destPixels;
  }

  // calls flowLine on each flowLine config object in this.flowLines
  glitchFlowLines() {
    this.flowLines.forEach((v, i, arr) => {
      arr[i].pixels = this.flowLine(v);
      if (arr[i].pixels) ImgUtil.copyPixels(arr[i].pixels, this.img);
    });
  }

  ///////////////////////
  // SORT
  ///////////////////////
  // sorts pixels horizontally by overall brightness
  sortPixels(spectrum) {
    const destPixels = new Uint8ClampedArray(this.img.pixels);

    for (let y = 0; y < this.img.height; y++) {
      if (y % 2) continue;

      const config = this.sortConfigs[y];
      const bin = floor(map(y, 0, this.img.height, 0, spectrum.length / 2));
      const level = spectrum[bin];

      const length = map(level, 0, 255, 0, this.img.width / 2);
      const center = this.pixelIndex(config.position, y);
      const start = center - floor(length * this.channelLen / 2);
      config.position += floor(config.speed / (level / 10 + 0.001));

      const pixels = [];

      for (let i = 0; i < length; i++) {
        const index = start + i * this.channelLen;
        pixels[i] = [
          destPixels[index],
          destPixels[index + 1],
          destPixels[index + 2],
        ];
      }

      pixels.sort((a, b) => ImgUtil.getBrightness(a) - ImgUtil.getBrightness(b));
      if (config.reverse) pixels.reverse();

      for (let i = 0; i < length; i++) {
        const index = start + i * this.channelLen;
        destPixels[index]     = pixels[i][0];
        destPixels[index + 1] = pixels[i][1];
        destPixels[index + 2] = pixels[i][2];
      }
    }

    ImgUtil.copyPixels(destPixels, this.img);
  }

  //////////////////////////
  // VERTICAL PIXEL GLITCH
  //////////////////////////
  verticalPixelGlitch(distortion=1) {
    const destPixels = new Uint8ClampedArray(this.img.pixels);
    let newColumn = false;
    let currentPixelPosition = -1, currentPixelRowIndex = -1;

    for (let x = 0; x < this.img.width; x++) {
      newColumn = true;
      currentPixelRowIndex = 0;
      let verticalPixelArray = [];

      for (let y = 0; y < this.img.height; y++) {
        const pixelIndex = this.pixelIndex(x, y);
        const rgba = ImgUtil.rgba(pixelIndex);
        const currentPixel = rgba.map(i => this.img.pixels[i]);
        const brightness = ImgUtil.getBrightness(currentPixel);

        if (brightness > distortion) {
          rgba.forEach(i => destPixels[i] = this.img.pixels[i]);

          if (!newColumn) {
            this.sortPixelsInColumn(verticalPixelArray, 0, currentPixelRowIndex - 1);

            for (let j = 0; j < currentPixelRowIndex; j++) {
              const newIndex = this.pixelIndex(x, j + currentPixelPosition)
              ImgUtil.rgb(newIndex).forEach(i => {
                destPixels[i] = verticalPixelArray[j][i];
              });
            }

            verticalPixelArray = [];
            currentPixelRowIndex = 0;
            newVerticalPixelColumn = true;
          }

        } else if (brightness <= distortion) {
          if (newColumn) {
            currentPixelPosition = y;
            newColumn = false;
          }

          verticalPixelArray[currentPixelRowIndex++] = currentPixel;
        }
      }

      if (!newColumn) {
        this.sortPixelsInColumn(verticalPixelArray, 0, currentPixelRowIndex - 1);

        for (let j = 0; j < currentPixelRowIndex; j++) {
          const newIndex = this.pixelIndex(x, j + currentPixelPosition);
          ImgUtil.rgb(newIndex).forEach(i => {
            destPixels[i] = verticalPixelArray[j][i];
          });
        }
      }
    }

    ImgUtil.copyPixels(destPixels, this.img);
  }

  sortPixelsInColumn(pixelArray, leftPixel, rightPixel) {
    let leftSidePixel = leftPixel;
    let rightSidePixel = rightPixel;
    let halfBrightness = ImgUtil.getBrightness(
      pixelArray[floor((leftPixel + rightPixel) / 2)]
    );

    while (leftSidePixel <= rightSidePixel) {
      while (pixelArray[leftSidePixel] && ImgUtil.getBrightness(pixelArray[leftSidePixel]) < halfBrightness) {
        if (pixelArray[leftSidePixel + 1]) leftSidePixel++;
      }

      while (pixelArray[rightSidePixel] && ImgUtil.getBrightness(pixelArray[rightSidePixel]) > halfBrightness) {
        if (pixelArray[rightSidePixel - 1]) rightSidePixel--;
      }

      if (leftSidePixel <= rightSidePixel) {
        const currentPixel = pixelArray[leftSidePixel];
        pixelArray[leftSidePixel--] = pixelArray[rightSidePixel];
        pixelArray[rightSidePixel++] = currentPixel;
      }
    }

    if (leftPixel < rightSidePixel)
      sortPixelsInColumn(pixelArray, leftPixel, rightSidePixel);

    if (leftSidePixel < rightPixel)
      sortPixelsInColumn(pixelArray, leftSidePixel, rightPixel);

    return pixelArray;
  }

  ///////////////////////
  // SHIFT LINE
  ///////////////////////
  // shifts a chunk of rows left or right as described by the config object
  shiftLine({ yMin, yMax, xOffset }) {
    const srcImg = this.img;
    const destPixels = new Uint8ClampedArray(srcImg.pixels);

    ImgUtil.forEachPixel(srcImg, rgba => rgba.forEach((i, idx) => {
      let j = i;
      if (idx < 3) j = i + xOffset;
      destPixels[i] = srcImg.pixels[j];
    }), y => (y > yMin && y < yMax));

    return destPixels;
  }

  // randomly shifts chunks of rows left or right
  glitchShiftLine(duration=1, rows=6) {
    const rangeH = this.img.height;

    for (let i = 0; i < rows; i++) {
      const yMin = floor(random(0, rangeH));
      const yMax = yMin + floor(random(1, rangeH - yMin));
      const xOffset = this.channelLen * floor(random(-40, 40));
      const config = { yMin, yMax, xOffset };

      this.shiftLineImg = this.shiftLine(config);
      ImgUtil.copyPixels(this.shiftLineImg, this.img);
    }

    this.holdShiftLine = true;

    setTimeout(() => this.holdShiftLine = false, duration);
  }

  ///////////////////////
  // SHIFT RGB
  ///////////////////////
  // shifts the rgb channels of the source image by the values in shift array
  // blend determines how much of the shifted image to blend into the original
  shiftRGB({ shift, blend=1, iterations=1, hold=false }) {
    const srcImg = this.img;
    let srcPixels = srcImg.pixels;
    const destPixels = new Uint8ClampedArray(srcImg.pixels);

    for (let i = 0; i < iterations; i++) {
      ImgUtil.forEachPixel(srcImg, rgba => rgba.forEach((i, idx) => {
        let j = i;
        if (idx < 3) j = (i + shift[idx]) % srcPixels.length;
        destPixels[i] = srcPixels[j];
        destPixels[i] = srcPixels[i] * (1 - blend) + srcPixels[j] * blend;
      }));
      srcPixels = new Uint8ClampedArray(destPixels);
    }

    if (hold) {
      this.holdShiftedImg = true;
      this.shiftedImg = destPixels;
    } else {
      this.holdShiftedImg = false;
    }

    ImgUtil.copyPixels(destPixels, this.img);
    return destPixels;
  }

  randomRGBShift(range=16) {
    const rand = () => floor(random(-range, range))
    const getRand = () => this.pixelIndex(rand(), rand());

    const shift = [ getRand(), getRand(), getRand() ];

    const shifted = this.shiftRGB({
      shift, blend: 0.8, iterations: 1
    });
  }

  ///////////////////////
  // TV STATIC
  ///////////////////////
  tvStatic(amount=0.5) {
    const destPixels = new Uint8ClampedArray(this.img.pixels);

    ImgUtil.forEachPixel(this.img, rgba => rgba.forEach(i => {
      destPixels[i] = this.img.pixels[i] * (1 - amount) + random(255) * amount;
    }));

    ImgUtil.copyPixels(destPixels, this.img);
  }


  // scatters random rectangles from the image
  scatterImgs() {
    this.scatImgs.forEach((config) => {
      push();
      translate((width - this.img.width) / 2, (height - this.img.height) / 2);
      if (floor(random(100)) > 80) {
        config.x = floor(random(-this.img.width * 0.3, this.img.width * 0.7));
        config.y = floor(random(-this.img.height * 0.1, this.img.height));
        config.img = ImgUtil.getRandomRectImg(this.img);
      }
      if (config.img) {
        image(config.img, config.x, config.y);
      }
      pop();
    });
  }

  show(reset=true) {
    const w = this.img.width; // * scale;
    const h = this.img.height; // * scale;
    push();
    translate((width - w) / 2, (height - h) / 2);
    image(this.img, 0, 0, w, h);
    pop();
  }
}
