# Century sweep: seeds 201-400, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-17 via kiln, bot at commit d5d6ccd.

**Outcome: 4 loss, 9 timeout, 187 win** (187/200 = 93.5% win rate, 0 JS errors)

Previous sweeps (seeds 1-200): 2026-09-15 muster 192W/8T/0L; c8e6d31 (seeds 1-100) 85W/14T/1L. Not directly comparable — different seed range.

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

Spec anomaly: seeds 306-310 and 356 were submitted with an extra top-level `behavior: aggressive` field (accepted by kiln; per-player behaviors were explicit, so the games should be identical to the intended spec).

All four losses share the known defensive-attrition signature: Brennus wins the value war but never destroys a single enemy building, holds ~20% map control vs Petra's 53-68%, and Petra eventually razes his only Civic Centre:

| seed | end | kills v lost | value v lost | enemy bldgs destroyed | map ctl v Petra peak |
|---|---|---|---|---|---|
| 279 | 31.0m | 246 v 254 | 25950 v 21550 | 0 | 17% v 53% |
| 316 | 35.0m | 270 v 306 | 28350 v 22900 | 0 | 22% v 68% |
| 356 | 36.4m | 292 v 316 | 32015 v 22050 | 0 | 22% v 67% |
| 373 | 43.1m | 383 v 426 | 41250 v 27050 | 0 | 23% v 64% |

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 201 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s201` |
| 202 | win | 27.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s202` |
| 203 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s203` |
| 204 | win | 29.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s204` |
| 205 | win | 31.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s205` |
| 206 | win | 21.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s206` |
| 207 | win | 25.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s207` |
| 208 | win | 26.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s208` |
| 209 | win | 25.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s209` |
| 210 | win | 28.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s210` |
| 211 | win | 28.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s211` |
| 212 | win | 33.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s212` |
| 213 | win | 27.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s213` |
| 214 | win | 23.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s214` |
| 215 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s215` |
| 216 | win | 24.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s216` |
| 217 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s217` |
| 218 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s218` |
| 219 | win | 36.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s219` |
| 220 | win | 23.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s220` |
| 221 | win | 35.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s221` |
| 222 | win | 26.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s222` |
| 223 | win | 33.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s223` |
| 224 | win | 24.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s224` |
| 225 | win | 30.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s225` |
| 226 | win | 23.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s226` |
| 227 | win | 24.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s227` |
| 228 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s228` |
| 229 | win | 24.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s229` |
| 230 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s230` |
| 231 | win | 24.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s231` |
| 232 | win | 38.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s232` |
| 233 | win | 36.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s233` |
| 234 | win | 26.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s234` |
| 235 | win | 23.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s235` |
| 236 | win | 26.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s236` |
| 237 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s237` |
| 238 | win | 27.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s238` |
| 239 | win | 26.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s239` |
| 240 | win | 32.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s240` |
| 241 | win | 36.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s241` |
| 242 | win | 24.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s242` |
| 243 | win | 28.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s243` |
| 244 | win | 44.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s244` |
| 245 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s245` |
| 246 | win | 24.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s246` |
| 247 | win | 34.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s247` |
| 248 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s248` |
| 249 | win | 28.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s249` |
| 250 | win | 20.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s250` |
| 251 | win | 26.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s251` |
| 252 | win | 22.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s252` |
| 253 | win | 21.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s253` |
| 254 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s254` |
| 255 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s255` |
| 256 | win | 28.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s256` |
| 257 | win | 30.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s257` |
| 258 | win | 26.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s258` |
| 259 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s259` |
| 260 | win | 24.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s260` |
| 261 | win | 21.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s261` |
| 262 | win | 26.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s262` |
| 263 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s263` |
| 264 | win | 35.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s264` |
| 265 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s265` |
| 266 | win | 21.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s266` |
| 267 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s267` |
| 268 | win | 22.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s268` |
| 269 | win | 30.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s269` |
| 270 | win | 30.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s270` |
| 271 | win | 25.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s271` |
| 272 | win | 38.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s272` |
| 273 | win | 31.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s273` |
| 274 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s274` |
| 275 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s275` |
| 276 | win | 28.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s276` |
| 277 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s277` |
| 278 | win | 24.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s278` |
| 279 | loss | 31.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s279` |
| 280 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s280` |
| 281 | win | 25.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s281` |
| 282 | win | 25.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s282` |
| 283 | win | 28.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s283` |
| 284 | win | 26.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s284` |
| 285 | win | 44.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s285` |
| 286 | win | 37.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s286` |
| 287 | win | 34.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s287` |
| 288 | win | 26.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s288` |
| 289 | win | 28.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s289` |
| 290 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s290` |
| 291 | win | 34.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s291` |
| 292 | win | 36.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s292` |
| 293 | win | 30.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s293` |
| 294 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s294` |
| 295 | win | 36.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s295` |
| 296 | win | 34.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s296` |
| 297 | win | 21.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s297` |
| 298 | win | 38.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s298` |
| 299 | win | 26.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s299` |
| 300 | win | 30.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s300` |
| 301 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s301` |
| 302 | win | 29.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s302` |
| 303 | win | 27.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s303` |
| 304 | win | 30.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s304` |
| 305 | win | 29.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s305` |
| 306 | win | 28.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s306` |
| 307 | win | 23.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s307` |
| 308 | win | 30.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s308` |
| 309 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s309` |
| 310 | win | 28.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s310` |
| 311 | win | 38.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s311` |
| 312 | win | 26.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s312` |
| 313 | win | 25.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s313` |
| 314 | win | 38.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s314` |
| 315 | win | 24.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s315` |
| 316 | loss | 35.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s316` |
| 317 | win | 27.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s317` |
| 318 | win | 26.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s318` |
| 319 | win | 29.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s319` |
| 320 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s320` |
| 321 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s321` |
| 322 | win | 24.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s322` |
| 323 | win | 26.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s323` |
| 324 | win | 24.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s324` |
| 325 | win | 23.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s325` |
| 326 | win | 26.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s326` |
| 327 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s327` |
| 328 | win | 23.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s328` |
| 329 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s329` |
| 330 | win | 26.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s330` |
| 331 | win | 26.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s331` |
| 332 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s332` |
| 333 | win | 23.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s333` |
| 334 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s334` |
| 335 | win | 28.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s335` |
| 336 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s336` |
| 337 | win | 28.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s337` |
| 338 | win | 27.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s338` |
| 339 | win | 25.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s339` |
| 340 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s340` |
| 341 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s341` |
| 342 | win | 23.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s342` |
| 343 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s343` |
| 344 | win | 24.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s344` |
| 345 | win | 28.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s345` |
| 346 | win | 21.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s346` |
| 347 | win | 29.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s347` |
| 348 | win | 34.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s348` |
| 349 | win | 23.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s349` |
| 350 | win | 23.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s350` |
| 351 | win | 21.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s351` |
| 352 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s352` |
| 353 | win | 33.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s353` |
| 354 | win | 21.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s354` |
| 355 | win | 25.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s355` |
| 356 | loss | 36.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s356` |
| 357 | win | 29.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s357` |
| 358 | win | 28.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s358` |
| 359 | win | 26.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s359` |
| 360 | win | 38.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s360` |
| 361 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s361` |
| 362 | win | 23.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s362` |
| 363 | win | 34.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s363` |
| 364 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s364` |
| 365 | win | 28.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s365` |
| 366 | win | 31.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s366` |
| 367 | win | 28.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s367` |
| 368 | win | 29.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s368` |
| 369 | win | 34.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s369` |
| 370 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s370` |
| 371 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s371` |
| 372 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s372` |
| 373 | loss | 43.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s373` |
| 374 | win | 43.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s374` |
| 375 | win | 22.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s375` |
| 376 | win | 30.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s376` |
| 377 | win | 28.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s377` |
| 378 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s378` |
| 379 | win | 28.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s379` |
| 380 | win | 26.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s380` |
| 381 | win | 27.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s381` |
| 382 | win | 31.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s382` |
| 383 | win | 23.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s383` |
| 384 | win | 31.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s384` |
| 385 | win | 26.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s385` |
| 386 | win | 26.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s386` |
| 387 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s387` |
| 388 | win | 28.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s388` |
| 389 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s389` |
| 390 | win | 23.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s390` |
| 391 | win | 25.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s391` |
| 392 | win | 25.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s392` |
| 393 | win | 24.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s393` |
| 394 | win | 25.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s394` |
| 395 | win | 23.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s395` |
| 396 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s396` |
| 397 | win | 26.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s397` |
| 398 | win | 35.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s398` |
| 399 | win | 24.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s399` |
| 400 | win | 39.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-17-d5d6ccd/artifacts/s400` |
