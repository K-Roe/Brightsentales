export type BrightlingSpec = {
  id: string;
  name: string;
  bodyColour: string;
  hairStyle: 'tuft' | 'swoop';
  hairColour: string;
  eyeStyle: 'round' | 'sparkle';
  clothingStyle: 'hoodie' | 'jacket';
  clothingColour: string;
  seed?: number;
};

export type BrightlingFrames = { idle: string; side: [string, string, string, string, string]; wave: [string, string, string] };

const colour = /^#[0-9a-fA-F]{6}$/;
const ink = '#272047';
const line = `stroke="${ink}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"`;

export function validateBrightlingSpec(value: BrightlingSpec): BrightlingSpec {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(value.id) || !/^[\p{L}][\p{L} '-]{0,39}$/u.test(value.name)) throw new Error('Invalid Brightling identity');
  for (const key of ['bodyColour', 'hairColour', 'clothingColour'] as const) if (!colour.test(value[key])) throw new Error(`Invalid ${key}`);
  if (!['tuft', 'swoop'].includes(value.hairStyle) || !['round', 'sparkle'].includes(value.eyeStyle) ||
      !['hoodie', 'jacket'].includes(value.clothingStyle)) throw new Error('Unsupported Brightling style');
  if (value.seed !== undefined && (!Number.isSafeInteger(value.seed) || value.seed < 0)) throw new Error('Invalid variation seed');
  return { ...value };
}

function shade(hex: string, amount: number): string {
  const channels = [1, 3, 5].map(start => Math.max(0, Math.min(255, parseInt(hex.slice(start, start + 2), 16) + amount)));
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function wrap(spec: BrightlingSpec, width: number, content: string): string {
  const body = spec.bodyColour, hair = spec.hairColour, coat = spec.clothingColour;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="724" viewBox="0 0 ${width} 724">
    <defs>
      <radialGradient id="skin"><stop stop-color="${shade(body, 34)}"/><stop offset=".7" stop-color="${body}"/><stop offset="1" stop-color="${shade(body, -30)}"/></radialGradient>
      <linearGradient id="hair" x2=".9" y2="1"><stop stop-color="${shade(hair, 40)}"/><stop offset=".48" stop-color="${hair}"/><stop offset="1" stop-color="${shade(hair, -28)}"/></linearGradient>
      <linearGradient id="coat" x2=".8" y2="1"><stop stop-color="${shade(coat, 28)}"/><stop offset=".55" stop-color="${coat}"/><stop offset="1" stop-color="${shade(coat, -35)}"/></linearGradient>
      <linearGradient id="shoe" x2="1" y2="1"><stop stop-color="#5962a9"/><stop offset="1" stop-color="#29376e"/></linearGradient>
    </defs>${content}</svg>`;
}

const star = `<path d="M217 405l11 23 25 4-18 18 4 26-22-12-22 12 4-26-18-18 25-4z" fill="#ffe26d" stroke="#f7b545" stroke-width="4" stroke-linejoin="round"/>`;
const eye = (x: number, style: BrightlingSpec['eyeStyle']) => `
  <ellipse cx="${x}" cy="255" rx="34" ry="42" fill="#fffefa" ${line}/>
  <ellipse cx="${x + 5}" cy="259" rx="21" ry="29" fill="${style === 'sparkle' ? '#4b2585' : '#40221d'}"/>
  <ellipse cx="${x + 6}" cy="262" rx="15" ry="23" fill="#171425"/>
  <ellipse cx="${x - 4}" cy="244" rx="9" ry="12" fill="#fff"/>
  <circle cx="${x + 16}" cy="266" r="4" fill="#fff"/>`;

function frontHair(spec: BrightlingSpec): string {
  const shift = (spec.seed ?? 0) % 9 - 4;
  return spec.hairStyle === 'tuft'
    ? `<path d="M98 159 Q92 96 143 82 Q119 52 146 32 Q172 47 180 77 Q196 32 250 35 Q236 65 219 85 Q285 46 337 86 Q292 108 255 111 Q321 100 350 140 Q296 148 255 133 Q210 169 176 153 Q135 176 98 159Z" fill="url(#hair)" ${line}/>
       <path d="M125 124 Q170 79 204 113 Q240 75 ${292 + shift} 95" fill="none" stroke="${shade(spec.hairColour, 56)}" stroke-width="13" stroke-linecap="round" opacity=".8"/>
       <path d="M185 151 Q211 179 230 155 Q256 127 284 132" fill="none" stroke="${shade(spec.hairColour, -31)}" stroke-width="5"/>`
    : `<path d="M89 158 Q83 92 137 66 Q189 23 261 50 Q335 63 346 123 Q305 132 259 118 Q231 162 176 154 Q129 179 89 158Z" fill="url(#hair)" ${line}/>
       <path d="M108 120 Q157 61 247 80 Q226 125 172 139 Q225 135 272 106" fill="none" stroke="${shade(spec.hairColour, 46)}" stroke-width="17" stroke-linecap="round"/>`;
}

function frontLegs(spec: BrightlingSpec): string {
  return `<path d="M146 501 Q141 533 148 565 L203 565 L208 516Z M226 516L229 565 286 565 Q293 536 285 501Z" fill="#34456d" ${line}/>
    <path d="M151 550L147 618 Q169 632 190 617L197 557Z M236 558L243 619 Q265 631 284 617L279 550Z" fill="url(#skin)" ${line}/>
    <path d="M148 604Q171 593 194 605L196 654 140 654Z M235 605Q260 593 284 604L290 655 235 655Z" fill="#44609d" ${line}/>
    <path d="M139 636Q116 638 104 663Q95 681 110 688Q152 700 205 688Q218 676 203 661Q191 646 166 645Z M232 661Q245 646 271 645Q316 644 331 673Q336 689 318 694Q272 701 229 689Q216 680 232 661Z" fill="url(#shoe)" ${line}/>
    <path d="M106 671Q155 679 204 669L202 688Q155 699 110 687Z M231 670Q278 680 329 672L323 690Q274 701 229 688Z" fill="#fff9eb" ${line}/>
    <path d="M144 653l37 5M141 664l42 5M250 656l39-4M249 667l43-5" fill="none" stroke="#fff9eb" stroke-width="7" stroke-linecap="round"/>`;
}

function frontArm(spec: BrightlingSpec, wave: 0 | 1 | 2 | 3, left: boolean): string {
  const skin = 'url(#skin)', coat = 'url(#coat)';
  if (!left || wave === 0) {
    const flip = left ? '' : ' transform="translate(434 0) scale(-1 1)"';
    return `<g${flip}><path d="M151 378Q119 368 96 402L72 468Q64 491 82 505L115 516Q132 505 137 490L171 410Z" fill="${coat}" ${line}/>
      <path d="M79 482Q103 499 132 489L131 507Q105 521 79 504Z" fill="${shade(spec.clothingColour, -27)}" ${line}/>
      <path d="M82 505Q66 507 69 532Q67 550 84 558Q93 565 101 557Q115 563 123 549Q137 534 126 514Q111 508 101 516Q90 501 82 505Z" fill="${skin}" ${line}/></g>`;
  }
  const arm = wave === 1
    ? `<path d="M150 384Q116 371 95 398L65 443Q54 462 69 477L91 491Q109 493 120 470L171 415Z" fill="${coat}" ${line}/>
       <path d="M64 450Q80 466 107 470L94 490Q72 489 59 471Z" fill="${shade(spec.clothingColour, -27)}" ${line}/>
       <path d="M66 448Q44 449 39 426Q32 412 45 406Q45 389 59 391Q66 378 77 389Q93 391 95 413L94 443Z" fill="${skin}" ${line}/>`
    : `<path d="M150 384Q125 365 104 382L76 411Q61 427 68 451Q72 468 93 468L119 449L169 412Z" fill="${coat}" ${line}/>
       <path d="M71 437Q84 451 112 445L103 466Q78 473 65 453Z" fill="${shade(spec.clothingColour, -27)}" ${line}/>
       <path d="${wave === 2 ? 'M74 440Q48 446 40 426L26 396Q19 381 28 377Q35 370 43 382L39 359Q38 342 48 342Q57 340 59 357L61 337Q64 324 74 327Q83 330 81 344L84 334Q89 324 98 330Q106 337 101 348Q113 341 120 351Q128 365 113 382L105 431Z' : 'M73 442Q49 445 40 428L27 407Q22 397 29 391Q35 386 43 392L37 375Q34 362 45 358Q54 356 61 369Q57 350 70 346Q81 343 87 361Q95 347 105 353Q117 361 107 376Q118 371 124 383Q132 399 114 413L106 436Z'}" fill="${skin}" ${line}/>
       <path d="M52 392Q64 386 77 396" fill="none" stroke="${shade(spec.bodyColour, -39)}" stroke-width="4" opacity=".65"/>`;
  return arm;
}

function front(spec: BrightlingSpec, wave: 0 | 1 | 2 | 3): string {
  const coat = spec.clothingColour;
  const body = `<g transform="translate(${wave ? 33 : 0} 0)">
    ${frontLegs(spec)}
    <path d="M148 349Q126 350 108 376L142 408Q171 394 183 369Z M251 369Q269 396 298 408L327 376Q307 350 286 349Z" fill="${shade(coat, -25)}" ${line}/>
    ${frontArm(spec, wave, true)}${frontArm(spec, 0, false)}
    <path d="M141 374Q172 353 217 355Q263 353 294 374Q315 419 309 502Q288 528 218 529Q146 528 125 503Q119 425 141 374Z" fill="url(#coat)" ${line}/>
    <path d="M129 501Q211 519 307 501L304 520Q217 540 132 520Z" fill="${shade(coat, -34)}" ${line}/>
    <path d="M157 466Q216 479 278 466Q270 505 217 506Q161 506 157 466Z" fill="none" stroke="${shade(coat, -44)}" stroke-width="4" opacity=".6"/>
    ${spec.clothingStyle === 'hoodie' ? `<path d="M179 366L215 401 254 366Q217 348 179 366Z" fill="${shade(coat, -35)}" ${line}/>
      <path d="M196 392L193 429M237 392L241 429" stroke="#fff4d9" stroke-width="5" stroke-linecap="round"/>` : `<path d="M193 368L217 408 239 368" fill="#fff4d9" ${line}/>
      <path d="M217 409L217 509" fill="none" stroke="${shade(coat, -40)}" stroke-width="5"/>`}
    ${star}
    <path d="M115 200Q88 188 76 214Q60 250 83 283Q105 300 126 275M320 201Q348 189 361 216Q375 250 354 283Q333 301 312 278" fill="url(#skin)" ${line}/>
    <path d="M99 227Q81 218 87 253M337 227Q354 220 348 254" fill="none" stroke="${shade(spec.bodyColour, -40)}" stroke-width="6" stroke-linecap="round"/>
    <path d="M217 104Q323 99 348 197Q363 262 323 315Q285 357 217 362Q149 357 110 315Q69 264 86 195Q107 104 217 104Z" fill="url(#skin)" ${line}/>
    ${frontHair(spec)}
    <path d="M137 221Q158 201 181 214M254 214Q278 201 298 221" fill="none" stroke="${shade(spec.hairColour, -8)}" stroke-width="10" stroke-linecap="round"/>
    ${eye(166, spec.eyeStyle)}${eye(268, spec.eyeStyle)}
    <ellipse cx="217" cy="279" rx="17" ry="11" fill="${shade(spec.bodyColour, -53)}" ${line}/>
    <ellipse cx="212" cy="275" rx="7" ry="3" fill="#fff" opacity=".55"/>
    <path d="M169 303Q217 347 265 303Q259 339 217 344Q175 339 169 303Z" fill="#542838" ${line}/>
    <path d="M186 324Q217 313 246 326Q227 346 209 340Q192 338 186 324Z" fill="#f0787e"/>
    <ellipse cx="126" cy="296" rx="18" ry="9" fill="#ff9fa6" opacity=".24"/>
    <ellipse cx="307" cy="296" rx="18" ry="9" fill="#ff9fa6" opacity=".24"/>
    <path d="M112 198Q115 164 147 150" fill="none" stroke="#fff" stroke-width="9" opacity=".25" stroke-linecap="round"/>
  </g>`;
  return wrap(spec, wave ? 500 : 434, body);
}

const gait = [
  { near: [249, 315, 622], far: [171, 139, 622] },
  { near: [246, 263, 608], far: [205, 202, 622] },
  { near: [192, 139, 622], far: [266, 319, 622] },
  { near: [219, 211, 622], far: [264, 281, 608] },
] as const;

function sideLeg(hip: number, knee: number, foot: number, ankleY: number, near: boolean): string {
  const fill = near ? '#344c7e' : '#293c68';
  return `<path d="M${hip - 20} 504Q${knee - 23} 526 ${knee - 17} 557L${foot - 18} ${ankleY + 4}Q${foot} ${ankleY + 16} ${foot + 17} ${ankleY + 3}L${knee + 17} 556Q${hip + 24} 527 ${hip + 22} 504Z" fill="${fill}" ${line}/>
    <g transform="translate(${foot} ${ankleY})">
      <path d="M-29 -8Q-4 -17 17 -8L23 4Q61 5 78 29Q84 46 66 49Q15 57 -34 49Q-52 41 -44 24Z" fill="url(#shoe)" ${line}/>
      <path d="M-44 29Q10 40 77 30L70 47Q15 59 -34 48Z" fill="#fff9ee" ${line}/>
      <path d="M-13 3L24 7M-17 16L27 20" fill="none" stroke="#fff9ee" stroke-width="7" stroke-linecap="round"/>
    </g>`;
}

function sideHair(spec: BrightlingSpec): string {
  return spec.hairStyle === 'tuft'
    ? `<path d="M109 159Q94 96 134 78Q127 48 153 37Q174 54 180 73Q203 30 251 36Q239 72 216 91Q278 49 317 89Q277 107 243 107Q304 107 327 144Q271 150 235 131Q168 164 109 159Z" fill="url(#hair)" ${line}/>
       <path d="M129 119Q172 75 206 104Q248 67 288 91" fill="none" stroke="${shade(spec.hairColour, 52)}" stroke-width="12" stroke-linecap="round"/>`
    : `<path d="M105 161Q91 90 156 61Q223 19 294 69Q329 93 326 133Q277 139 238 121Q184 159 105 161Z" fill="url(#hair)" ${line}/>
       <path d="M124 114Q184 56 269 80Q244 115 196 126" fill="none" stroke="${shade(spec.hairColour, 48)}" stroke-width="14" stroke-linecap="round"/>`;
}

function side(spec: BrightlingSpec, frame: 0 | 1 | 2 | 3 | 4): string {
  const pose = frame ? gait[frame - 1] : { near: [249, 249, 622], far: [190, 183, 622] };
  const nearForward = frame === 1 || frame === 2;
  const backArm = nearForward
    ? 'M189 382Q168 388 155 421L127 465Q132 485 156 493L180 474L222 413Z'
    : 'M189 382Q162 389 154 418L166 480Q185 496 201 478L221 413Z';
  const nearArm = nearForward
    ? 'M270 385Q292 397 304 431L314 481Q296 498 274 487L247 431Z'
    : 'M268 384Q289 388 301 413L331 456Q327 479 306 485L275 461L242 419Z';
  return wrap(spec, 486, `<g transform="translate(26 0)">
    ${sideLeg(207, pose.far[0], pose.far[1], pose.far[2], false)}
    <path d="${backArm}" fill="${shade(spec.clothingColour, -31)}" ${line}/>
    <path d="M148 468Q131 460 121 475Q112 493 130 505Q143 514 158 497L170 482Z" fill="url(#skin)" ${line}/>
    ${sideLeg(256, pose.near[0], pose.near[1], pose.near[2], true)}
    <path d="M190 362Q225 347 262 369Q286 392 289 434L297 512Q252 538 190 521Q174 485 178 424Q176 381 190 362Z" fill="url(#coat)" ${line}/>
    <path d="M188 504Q244 520 296 504L296 522Q242 540 190 521Z" fill="${shade(spec.clothingColour, -31)}" ${line}/>
    <path d="M222 410l11 21 21 4-16 16 4 23-20-11-20 11 4-23-16-16 22-4Z" fill="#ffe26d" stroke="#f7b545" stroke-width="4"/>
    <path d="${nearArm}" fill="url(#coat)" ${line}/>
    <path d="${nearForward ? 'M281 470Q302 466 315 478Q331 489 320 505Q308 517 291 508L275 489Z' : 'M306 454Q325 444 339 458Q349 473 332 488Q318 497 301 480Z'}" fill="url(#skin)" ${line}/>
    <path d="M126 220Q101 206 96 234Q95 262 119 274L140 258Z" fill="url(#skin)" ${line}/>
    <path d="M205 106Q294 99 338 161Q360 185 365 225Q390 231 390 248Q388 268 366 270Q353 323 292 350Q223 372 159 325Q109 286 111 223Q111 145 205 106Z" fill="url(#skin)" ${line}/>
    ${sideHair(spec)}
    <path d="M306 214Q323 200 337 211" fill="none" stroke="${shade(spec.hairColour, -8)}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="320" cy="252" rx="31" ry="43" fill="#fffefa" ${line}/>
    <ellipse cx="332" cy="256" rx="19" ry="29" fill="${spec.eyeStyle === 'sparkle' ? '#4b2585' : '#40221d'}"/>
    <ellipse cx="337" cy="259" rx="13" ry="23" fill="#171425"/>
    <ellipse cx="324" cy="242" rx="8" ry="11" fill="#fff"/>
    <circle cx="344" cy="268" r="4" fill="#fff"/>
    <ellipse cx="375" cy="242" rx="12" ry="8" fill="${shade(spec.bodyColour, -56)}" ${line}/>
    <path d="M323 295Q346 320 369 294" fill="none" stroke="#5d283e" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="277" cy="295" rx="18" ry="9" fill="#ff9fa6" opacity=".2"/>
    <path d="M130 177Q132 146 161 133" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".25"/>
  </g>`);
}

export function generateBrightlingFrames(input: BrightlingSpec): BrightlingFrames {
  const spec = validateBrightlingSpec(input);
  return {
    idle: front(spec, 0),
    side: [side(spec, 0), side(spec, 1), side(spec, 2), side(spec, 3), side(spec, 4)],
    wave: [front(spec, 1), front(spec, 2), front(spec, 3)],
  };
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const OLIVER_SPEC: BrightlingSpec = {
  id: 'oliver', name: 'Oliver', bodyColour: '#73d9b2', hairStyle: 'tuft', hairColour: '#483078',
  eyeStyle: 'round', clothingStyle: 'hoodie', clothingColour: '#f3923e', seed: 7,
};

export const SAMPLE_VARIATION_SPEC: BrightlingSpec = {
  id: 'sample-variation', name: 'Sample', bodyColour: '#e9a7bb', hairStyle: 'swoop', hairColour: '#145e72',
  eyeStyle: 'sparkle', clothingStyle: 'jacket', clothingColour: '#6570bd', seed: 19,
};
