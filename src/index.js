import simpleKeyboard from "https://cdn.jsdelivr.net/npm/simple-keyboard@3.7.77/+esm";
import { Romaji } from "https://cdn.jsdelivr.net/npm/@marmooo/romaji/+esm";

const remSize = parseInt(getComputedStyle(document.documentElement).fontSize);
const gamePanel = document.getElementById("gamePanel");
const infoPanel = document.getElementById("infoPanel");
const countPanel = document.getElementById("countPanel");
const scorePanel = document.getElementById("scorePanel");
const startButton = document.getElementById("startButton");
const romaNode = document.getElementById("roma");
const japaneseNode = document.getElementById("japanese");
const gradeOption = document.getElementById("gradeOption");
const aa = document.getElementById("aa");
const tmpCanvas = document.createElement("canvas");
const mode = document.getElementById("mode");
const gameTime = 120;
let playing;
let countdowning;
let typeTimer;
// https://dova-s.jp/bgm/play22301.html
const bgm = new Audio("mp3/bgm.mp3");
bgm.volume = 0.3;
bgm.loop = true;
let errorCount = 0;
let normalCount = 0;
let solveCount = 0;
let totalCount = 0n;
let problem;
let guide = false;
const layout104 = {
  "default": [
    "{tab} q w e r t y u i o p [ ]",
    "{lock} a s d f g h j k l ;",
    "{shift} z x c v b n m , .",
    "🌏 {altLeft} {space} {altRight}",
  ],
  "shift": [
    "{tab} Q W E R T Y U I O P { }",
    "{lock} A S D F G H J K L :",
    "{shift} Z X C V B N M < >",
    "🌏 {altLeft} {space} {altRight}",
  ],
};
const layout109 = {
  "default": [
    "{tab} q w e r t y u i o p",
    "{lock} a s d f g h j k l ;",
    "{shift} z x c v b n m , .",
    "🌏 無変換 {space} 変換",
  ],
  "shift": [
    "{tab} Q W E R T Y U I O P",
    "{lock} A S D F G H J K L +",
    "{shift} Z X C V B N M < >",
    "🌏 無変換 {space} 変換",
  ],
};
const keyboardDisplay = {
  "{tab}": "Tab",
  "{lock}": "Caps",
  "{shift}": "Shift",
  "{space}": " ",
  "{altLeft}": "Alt",
  "{altRight}": "Alt",
  "🌏": (navigator.language.startsWith("ja")) ? "🇯🇵" : "🇺🇸",
};
const keyboard = new simpleKeyboard.default({
  layout: (navigator.language.startsWith("ja")) ? layout109 : layout104,
  display: keyboardDisplay,
  onInit: () => {
    document.getElementById("keyboard").classList.add("d-none");
  },
  onKeyPress: (input) => {
    switch (input) {
      case "{esc}":
        return typeEventKey("Escape");
      case "{space}":
        return typeEventKey(" ");
      case "無変換":
      case "{altLeft}":
        return typeEventKey("NonConvert");
      case "変換":
      case "{altRight}":
        return typeEventKey("Convert");
      case "🌏":
        if (keyboard.options.layout == layout109) {
          keyboardDisplay["🌏"] = "🇺🇸";
          keyboard.setOptions({
            layout: layout104,
            display: keyboardDisplay,
          });
        } else {
          keyboardDisplay["🌏"] = "🇯🇵";
          keyboard.setOptions({
            layout: layout109,
            display: keyboardDisplay,
          });
        }
        break;
      case "{shift}":
      case "{lock}": {
        const shiftToggle = (keyboard.options.layoutName == "default")
          ? "shift"
          : "default";
        keyboard.setOptions({ layoutName: shiftToggle });
        break;
      }
      default:
        return typeEventKey(input);
    }
  },
});
let audioContext;
const audioBufferCache = {};
let englishVoices = [];
loadVoices();
loadConfig();

function loadConfig() {
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
  if (localStorage.getItem("bgm") != 1) {
    document.getElementById("bgmOn").classList.add("d-none");
    document.getElementById("bgmOff").classList.remove("d-none");
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    document.documentElement.setAttribute("data-bs-theme", "light");
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function toggleBGM() {
  if (localStorage.getItem("bgm") == 1) {
    document.getElementById("bgmOn").classList.add("d-none");
    document.getElementById("bgmOff").classList.remove("d-none");
    localStorage.setItem("bgm", 0);
    bgm.pause();
  } else {
    document.getElementById("bgmOn").classList.remove("d-none");
    document.getElementById("bgmOff").classList.add("d-none");
    localStorage.setItem("bgm", 1);
    bgm.play();
  }
}

function toggleKeyboard() {
  const virtualKeyboardOn = document.getElementById("virtualKeyboardOn");
  const virtualKeyboardOff = document.getElementById("virtualKeyboardOff");
  if (virtualKeyboardOn.classList.contains("d-none")) {
    virtualKeyboardOn.classList.remove("d-none");
    virtualKeyboardOff.classList.add("d-none");
    document.getElementById("keyboard").classList.remove("d-none");
    resizeFontSize(aa);
  } else {
    virtualKeyboardOn.classList.add("d-none");
    virtualKeyboardOff.classList.remove("d-none");
    document.getElementById("keyboard").classList.add("d-none");
    document.getElementById("guideSwitch").checked = false;
    guide = false;
    resizeFontSize(aa);
  }
}

function toggleGuide(event) {
  if (event.target.checked) {
    guide = true;
    if (problem) {
      const nextKey = problem.romaji.currentNode.children.keys().next().value;
      showGuide(nextKey);
    }
  } else {
    guide = false;
    if (problem) removePrevGuide(problem);
  }
}

function createAudioContext() {
  if (globalThis.AudioContext) {
    return new globalThis.AudioContext();
  } else {
    console.error("Web Audio API is not supported in this browser");
    return null;
  }
}

function unlockAudio() {
  if (audioContext) {
    audioContext.resume();
  } else {
    audioContext = createAudioContext();
    loadAudio("end", "mp3/end.mp3");
    loadAudio("keyboard", "mp3/keyboard.mp3");
    loadAudio("correct", "mp3/correct.mp3");
    loadAudio("incorrect", "mp3/cat.mp3");
  }
  document.removeEventListener("click", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);
}

async function loadAudio(name, url) {
  if (!audioContext) return;
  if (audioBufferCache[name]) return audioBufferCache[name];
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBufferCache[name] = audioBuffer;
    return audioBuffer;
  } catch (error) {
    console.error(`Loading audio ${name} error:`, error);
    throw error;
  }
}

function playAudio(name, volume) {
  if (!audioContext) return;
  const audioBuffer = audioBufferCache[name];
  if (!audioBuffer) {
    console.error(`Audio ${name} is not found in cache`);
    return;
  }
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  const gainNode = audioContext.createGain();
  if (volume) gainNode.gain.value = volume;
  gainNode.connect(audioContext.destination);
  sourceNode.connect(gainNode);
  sourceNode.start();
}

function loadVoices() {
  // https://stackoverflow.com/questions/21513706/
  const allVoicesObtained = new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length !== 0) {
      resolve(voices);
    } else {
      let supported = false;
      speechSynthesis.addEventListener("voiceschanged", () => {
        supported = true;
        voices = speechSynthesis.getVoices();
        resolve(voices);
      });
      setTimeout(() => {
        if (!supported) {
          document.getElementById("noTTS").classList.remove("d-none");
        }
      }, 1000);
    }
  });
  const jokeVoices = [
    // "com.apple.eloquence.en-US.Flo",
    "com.apple.speech.synthesis.voice.Bahh",
    "com.apple.speech.synthesis.voice.Albert",
    // "com.apple.speech.synthesis.voice.Fred",
    "com.apple.speech.synthesis.voice.Hysterical",
    "com.apple.speech.synthesis.voice.Organ",
    "com.apple.speech.synthesis.voice.Cellos",
    "com.apple.speech.synthesis.voice.Zarvox",
    // "com.apple.eloquence.en-US.Rocko",
    // "com.apple.eloquence.en-US.Shelley",
    // "com.apple.speech.synthesis.voice.Princess",
    // "com.apple.eloquence.en-US.Grandma",
    // "com.apple.eloquence.en-US.Eddy",
    "com.apple.speech.synthesis.voice.Bells",
    // "com.apple.eloquence.en-US.Grandpa",
    "com.apple.speech.synthesis.voice.Trinoids",
    // "com.apple.speech.synthesis.voice.Kathy",
    // "com.apple.eloquence.en-US.Reed",
    "com.apple.speech.synthesis.voice.Boing",
    "com.apple.speech.synthesis.voice.Whisper",
    "com.apple.speech.synthesis.voice.Deranged",
    "com.apple.speech.synthesis.voice.GoodNews",
    "com.apple.speech.synthesis.voice.BadNews",
    "com.apple.speech.synthesis.voice.Bubbles",
    // "com.apple.voice.compact.en-US.Samantha",
    // "com.apple.eloquence.en-US.Sandy",
    // "com.apple.speech.synthesis.voice.Junior",
    // "com.apple.speech.synthesis.voice.Ralph",
  ];
  allVoicesObtained.then((voices) => {
    englishVoices = voices
      .filter((voice) => voice.lang == "en-US")
      .filter((voice) => !jokeVoices.includes(voice.voiceURI));
  });
}

function speak(text) {
  speechSynthesis.cancel();
  text = text // 英語を綺麗に発音
    .replace(/si/g, "shi")
    .replace(/ti/g, "chi")
    .replace(/ni/g, "nee")
    .replace(/juu/g, "jew");
  const msg = new globalThis.SpeechSynthesisUtterance(text);
  msg.voice = englishVoices[Math.floor(Math.random() * englishVoices.length)];
  msg.lang = "en-US";
  speechSynthesis.speak(msg);
}

function nextProblem() {
  playAudio("correct", 0.3);
  solveCount += 1;
  totalCount += problem.num;
  typable();
}

function removePrevGuide(problem) {
  if (!problem) return;
  const prevNode = problem.romaji.currentNode;
  if (!prevNode) return;
  for (const key of prevNode.children.keys()) {
    removeGuide(key);
  }
}

function removeGuide(key) {
  if (key == " ") key = "{space}";
  const button = keyboard.getButtonElement(key);
  if (button) {
    button.classList.remove("guide");
    keyboard.setOptions({ layoutName: "default" });
  } else {
    const shift = keyboard.getButtonElement("{shift}");
    if (shift) shift.classList.remove("guide");
  }
}

function showGuide(key) {
  if (key == " ") key = "{space}";
  const button = keyboard.getButtonElement(key);
  if (button) {
    button.classList.add("guide");
  } else {
    const shift = keyboard.getButtonElement("{shift}");
    if (shift) shift.classList.add("guide");
  }
}

function upKeyEvent(event) {
  switch (event.key) {
    case "Shift":
    case "CapsLock":
      if (guide) {
        keyboard.setOptions({ layoutName: "default" });
        showGuide(problem.romaji.remainedRomaji[0]);
      }
  }
}

function typeEvent(event) {
  switch (event.code) {
    case "Space":
      event.preventDefault();
      // falls through
    default:
      typeEventKey(event.key);
  }
}

function typeEventKey(key) {
  switch (key) {
    case "NonConvert": {
      changeVisibility("visible");
      downTime(5);
      return;
    }
    case "Convert":
      speak(problem.roma);
      return;
    case "Shift":
    case "CapsLock":
      if (guide) {
        keyboard.setOptions({ layoutName: "shift" });
        showGuide(problem.romaji.remainedRomaji[0]);
      }
      return;
    case "Escape":
      startGame();
      return;
    case " ":
      if (!playing) {
        startGame();
        return;
      }
  }
  if (key.length == 1) {
    if (!problem) return;
    key = key.toLowerCase();
    const romaji = problem.romaji;
    const prevNode = romaji.currentNode;
    const state = romaji.input(key);
    if (state) {
      playAudio("keyboard");
      normalCount += 1;
      const remainedRomaji = romaji.remainedRomaji;
      const children = romaNode.children;
      children[0].textContent += key;
      children[1].textContent = remainedRomaji[0];
      children[2].textContent = remainedRomaji.slice(1);
      const cleared = children[0].textContent;
      const match = cleared.match(unitEndRegexp);
      if (match) {
        const unit = match[0];
        children[0].textContent = cleared.slice(
          cleared.indexOf(unit) + unit.length,
        );
        const ja = japanese.textContent;
        const unitReading = unitReadings[unit];
        japanese.textContent = ja.slice(
          ja.indexOf(unitReading) + unitReading.length,
        );
      }
      for (const key of prevNode.children.keys()) {
        removeGuide(key);
      }
      if (romaji.isEnd()) {
        nextProblem();
      } else if (guide) {
        showGuide(remainedRomaji[0]);
      }
    } else {
      playAudio("incorrect", 0.3);
      errorCount += 1;
    }
  }
}

function startGame() {
  clearInterval(typeTimer);
  initTime();
  countdown();
  countPanel.classList.remove("d-none");
  scorePanel.classList.add("d-none");
}

function resizeFontSize(node) {
  // https://stackoverflow.com/questions/118241/
  function getTextWidth(text, font) {
    // re-use canvas object for better performance
    // const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    const context = tmpCanvas.getContext("2d");
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width;
  }
  function getTextRect(text, fontSize, font, lineHeight) {
    const lines = text.split("\n");
    const fontConfig = fontSize + "px " + font;
    let maxWidth = 0;
    for (let i = 0; i < lines.length; i++) {
      const width = getTextWidth(lines[i], fontConfig);
      if (maxWidth < width) {
        maxWidth = width;
      }
    }
    return [maxWidth, fontSize * lines.length * lineHeight];
  }
  function getPaddingRect(style) {
    const width = parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight);
    const height = parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    return [width, height];
  }
  const style = getComputedStyle(node);
  const font = style.fontFamily;
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) / fontSize;
  const nodeHeight = globalThis.innerHeight - 360;
  const nodeWidth = infoPanel.clientWidth;
  const nodeRect = [nodeWidth, nodeHeight];
  const textRect = getTextRect(node.textContent, fontSize, font, lineHeight);
  const paddingRect = getPaddingRect(style);

  // https://stackoverflow.com/questions/46653569/
  // Safariで正確な算出ができないので誤差ぶんだけ縮小化 (10%)
  const rowFontSize = fontSize * (nodeRect[0] - paddingRect[0]) / textRect[0] *
    0.90;
  const colFontSize = fontSize * (nodeRect[1] - paddingRect[1]) / textRect[1] *
    0.90;
  if (colFontSize < rowFontSize) {
    if (colFontSize < remSize) {
      node.style.fontSize = remSize + "px";
    } else {
      node.style.fontSize = colFontSize + "px";
    }
  } else {
    if (rowFontSize < remSize) {
      node.style.fontSize = remSize + "px";
    } else {
      node.style.fontSize = rowFontSize + "px";
    }
  }
}

function changeVisibility(visibility) {
  const children = romaNode.children;
  children[1].style.visibility = visibility;
  children[2].style.visibility = visibility;
  japanese.style.visibility = visibility;
}

function typable() {
  const option = gradeOption.options[gradeOption.selectedIndex];
  const digits = Number(option.value);
  const num = (digits === 72)
    ? getRandomBigInt(digits - 15, digits)
    : getRandomBigInt(digits - 3, digits);
  const hira = bigintToHiragana(num);
  const prevProblem = problem;
  aa.textContent = formatNumber(num);
  japaneseNode.textContent = hira;
  const romaji = new Romaji(hira);
  const roma = romaji.remainedRomaji;
  problem = { hira, roma, romaji, num };
  const children = romaNode.children;
  children[0].textContent = romaji.inputedRomaji;
  children[1].textContent = romaji.remainedRomaji[0];
  children[2].textContent = romaji.remainedRomaji.slice(1);

  if (mode.textContent == "EASY") speak(problem.hira);
  const visibility = (mode.textContent == "EASY") ? "visible" : "hidden";
  changeVisibility(visibility);
  resizeFontSize(aa);
  if (guide) {
    removePrevGuide(prevProblem);
    showGuide(problem.roma[0]);
  }
}

function countdown() {
  const aaOuter = document.getElementById("aaOuter");
  const typePanel = document.getElementById("typePanel");
  const keyboardPanel = document.getElementById("keyboard");
  aaOuter.after(typePanel, keyboardPanel);

  speak(""); // unlock
  if (countdowning) return;
  countdowning = true;
  if (localStorage.getItem("bgm") == 1) bgm.play();
  document.getElementById("guideSwitch").disabled = true;
  document.getElementById("virtualKeyboard").disabled = true;
  gamePanel.classList.add("d-none");
  infoPanel.classList.add("d-none");
  countPanel.classList.remove("d-none");
  counter.textContent = 3;
  const timer = setInterval(() => {
    const counter = document.getElementById("counter");
    const colors = ["skyblue", "greenyellow", "violet", "tomato"];
    if (parseInt(counter.textContent) > 1) {
      const t = parseInt(counter.textContent) - 1;
      counter.style.backgroundColor = colors[t];
      counter.textContent = t;
    } else {
      countdowning = false;
      playing = true;
      removePrevGuide(problem);
      normalCount = errorCount = solveCount = 0;
      totalCount = 0n;
      clearInterval(timer);
      document.getElementById("guideSwitch").disabled = false;
      document.getElementById("virtualKeyboard").disabled = false;
      gamePanel.classList.remove("d-none");
      countPanel.classList.add("d-none");
      infoPanel.classList.remove("d-none");
      scorePanel.classList.add("d-none");
      resizeFontSize(aa);
      globalThis.scrollTo({
        top: document.getElementById("gamePanel").getBoundingClientRect().top,
        behavior: "auto",
      });
      typable();
      startTypeTimer();
    }
  }, 1000);
}

function startTypeTimer() {
  const timeNode = document.getElementById("time");
  typeTimer = setInterval(() => {
    const t = parseInt(timeNode.textContent);
    if (t > 0) {
      timeNode.textContent = t - 1;
    } else {
      clearInterval(typeTimer);
      bgm.pause();
      playAudio("end");
      scoring();
    }
  }, 1000);
}

function downTime(n) {
  const timeNode = document.getElementById("time");
  const t = parseInt(timeNode.textContent);
  const downedTime = t - n;
  if (downedTime < 0) {
    timeNode.textContent = 0;
  } else {
    timeNode.textContent = downedTime;
  }
}

function initTime() {
  document.getElementById("time").textContent = gameTime;
}

gradeOption.addEventListener("change", () => {
  initTime();
  clearInterval(typeTimer);
});

function scoring() {
  playing = false;
  infoPanel.classList.remove("d-none");
  gamePanel.classList.add("d-none");
  countPanel.classList.add("d-none");
  scorePanel.classList.remove("d-none");
  let time = parseInt(document.getElementById("time").textContent);
  if (time < gameTime) {
    time = gameTime - time;
  }
  const typeSpeed = (normalCount / time).toFixed(2);
  document.getElementById("totalType").textContent = normalCount + errorCount;
  document.getElementById("typeSpeed").textContent = typeSpeed;
  document.getElementById("errorType").textContent = errorCount;
  document.getElementById("clearPoint").textContent = formatNumber(totalCount);
}

function changeMode(event) {
  normalCount = errorCount = solveCount = 0;
  totalCount = 0n;
  document.getElementById("time").textContent = gameTime;
  if (event.target.textContent == "EASY") {
    event.target.textContent = "HARD";
  } else {
    event.target.textContent = "EASY";
  }
  const visibility = (mode.textContent == "EASY") ? "visible" : "hidden";
  changeVisibility(visibility);
}

// function bigintToKanji(num) {
//   if (num === 0n) return "零";
//   const kanjiDigits = [
//     "零",
//     "一",
//     "二",
//     "三",
//     "四",
//     "五",
//     "六",
//     "七",
//     "八",
//     "九",
//   ];
//   const units = ["", "十", "百", "千"];
//   const bigUnits = [
//     "",
//     "万",
//     "億",
//     "兆",
//     "京",
//     "垓",
//     "秭",
//     "穣",
//     "溝",
//     "澗",
//     "正",
//     "載",
//     "極",
//     "恒河沙",
//     "阿僧祇",
//     "那由他",
//     "不可思議",
//     "無量大数",
//   ];
//   const split4Digits = [];
//   let n = num;
//   while (n > 0n) {
//     split4Digits.push(n % 10000n);
//     n /= 10000n;
//   }
//   const to4Kanji = (n4) => {
//     let result = "";
//     const str = n4.toString().padStart(4, "0");
//     for (let i = 0; i < 4; i++) {
//       const digit = +str[i];
//       if (digit !== 0) {
//         if (!(digit === 1 && i === 0 && i === 0)) {
//           result += (digit === 1 && i !== 0) ? "" : kanjiDigits[digit];
//         }
//         result += units[3 - i];
//       }
//     }
//     return result;
//   };
//   let result = "";
//   for (let i = split4Digits.length - 1; i >= 0; i--) {
//     const part = split4Digits[i];
//     if (part === 0n) continue;
//     result += to4Kanji(part) + bigUnits[i] + "\n";
//   }
//   return result;
// }

function bigintToHiragana(num) {
  if (num === 0n) return "ぜろ";
  const digitHira = [
    "ぜろ",
    "いち",
    "に",
    "さん",
    "よん",
    "ご",
    "ろく",
    "なな",
    "はち",
    "きゅう",
  ];
  const units = ["", "じゅう", "ひゃく", "せん"];
  const bigUnits = [
    "",
    "まん",
    "おく",
    "ちょう",
    "けい",
    "がい",
    "し",
    "じょう",
    "こう",
    "かん",
    "せい",
    "さい",
    "ごく",
    "ごうがしゃ",
    "あそうぎ",
    "なゆた",
    "ふかしぎ",
    "むりょうたいすう",
  ];
  // 特殊読み
  const specialReadings = {
    "1ひゃく": "ひゃく",
    "3ひゃく": "さんびゃく",
    "6ひゃく": "ろっぴゃく",
    "8ひゃく": "はっぴゃく",
    "1せん": "せん",
    "3せん": "さんぜん",
    "8せん": "はっせん",
  };
  const split4Digits = [];
  let n = num;
  while (n > 0n) {
    split4Digits.push(n % 10000n);
    n /= 10000n;
  }
  const to4Hiragana = (n4) => {
    const str = n4.toString().padStart(4, "0");
    let result = "";
    for (let i = 0; i < 4; i++) {
      const d = +str[i];
      if (d === 0) continue;
      const unit = units[3 - i];
      const key = `${d}${unit}`;
      if (specialReadings[key]) {
        result += specialReadings[key];
      } else {
        result += (d === 1 && unit !== "") ? unit : digitHira[d] + unit;
      }
    }
    return result;
  };
  let result = "";
  for (let i = split4Digits.length - 1; i >= 0; i--) {
    const part = split4Digits[i];
    if (part === 0n) continue;
    result += to4Hiragana(part) + bigUnits[i];
  }
  return result;
}

function getRandomBigInt(minDigits, maxDigits) {
  const digits = Math.floor(Math.random() * (maxDigits - minDigits + 1)) +
    minDigits;
  let result = "";
  for (let i = 0; i < digits; i++) {
    const digit = i === 0
      ? Math.floor(Math.random() * 9) + 1
      : Math.floor(Math.random() * 10);
    result += digit.toString();
  }
  return BigInt(result);
}

function formatNumber(n) {
  const str = n.toString();
  const parts = [];
  let i = str.length;
  while (i > 4) {
    parts.unshift(str.slice(i - 4, i));
    i -= 4;
  }
  parts.unshift(str.slice(0, i));
  return parts.join(",");
}

const unitEndRegexp =
  /(man|(?<!r)oku|chou|tyou|kei|gai|(?:si|shi)|jou|kou|kan|sei|sai|goku|gouga(?:sya|sha)|asougi|nayuta|(?:fuka|huka)(?:si|shi)gi|muryoutaisuu)$/i;
const unitReadings = {
  man: "まん",
  oku: "おく",
  chou: "ちょう",
  tyou: "ちょう",
  kei: "けい",
  gai: "がい",
  si: "し",
  shi: "し",
  jou: "じょう",
  kou: "こう",
  kan: "かん",
  sei: "せい",
  sai: "さい",
  goku: "ごく",
  gougasya: "ごうがしゃ",
  gougasha: "ごうがしゃ",
  asougi: "あそうぎ",
  nayuta: "なゆた",
  fukashigi: "ふかしぎ",
  fukasigi: "ふかしぎ",
  hukashigi: "ふかしぎ",
  hukasigi: "ふかしぎ",
  muryoutaisuu: "むりょうたいすう",
};

resizeFontSize(aa);

document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("toggleBGM").onclick = toggleBGM;
document.getElementById("virtualKeyboard").onclick = toggleKeyboard;
globalThis.addEventListener("resize", () => {
  resizeFontSize(aa);
});
document.getElementById("mode").onclick = changeMode;
document.getElementById("guideSwitch").onchange = toggleGuide;
startButton.addEventListener("click", startGame);
document.addEventListener("keyup", upKeyEvent);
document.addEventListener("keydown", typeEvent);
document.addEventListener("click", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });
