# recmust3 sweep: seeds 201-361, standard settings, recovery muster + war surge + emergency barter

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-20/21 via kiln (vps runner only; pc down), bot at the recovery-muster working tree.

**Outcome: 3 loss, 5 timeout, 153 win** (153/161 = 95.0% win rate, 0 JS errors). Seeds 362-400 were not run (submission cut short).

Baseline for the same 161 seeds (2026-09-17-d5d6ccd): 3 loss / 7 timeout / 151 win. Target of the change: the baseline's 4 losses (279, 316, 356, 373) via the war-chest muster-floor deadlock (see docs/LESSONS_LEARNED.md 2026-09-20). s373 is outside the submitted range; its probe showed the same loss->near-win-timeout flip.

Changed seeds:

| seed | baseline | this sweep | note |
|---|---|---|---|
| 244 | win (44.4m) | loss (33.0m) | regression: war surge -> early ramless raid donated the army (LESSONS 2026-09-21) |
| 263 | timeout (45.0m) | loss (43.0m) | hopeless map (Petra 129 army by t=16), baseline merely survived to the cap |
| 267 | timeout (45.0m) | loss (43.0m) | hopeless camped map, baseline survived to the cap |
| 279 | loss (31.0m) | win (41.3m) | target seed, flipped |
| 316 | loss (35.0m) | timeout (45.0m) | target seed, no longer loses |
| 320 | timeout (45.0m) | win (40.3m) |  |
| 327 | win (29.0m) | timeout (45.0m) | cap coin-flip |
| 340 | timeout (45.0m) | win (39.2m) |  |
| 352 | timeout (45.0m) | win (31.0m) |  |
| 356 | loss (36.4m) | timeout (45.0m) | target seed, no longer loses |

Verdict rules as in the baseline sweep: `timeout` = 45-min in-game limit reached; `win`/`loss` = game ended before the limit; 0 ERROR/script-exception lines in all 161 logs.

| seed | result | game min | baseline |
|---|---|---|---|
| 201 | win | 23.0 | win (23.0m) |
| 202 | win | 24.9 | win (27.3m) |
| 203 | win | 28.7 | win (28.0m) |
| 204 | win | 31.4 | win (29.9m) |
| 205 | win | 28.3 | win (31.8m) |
| 206 | win | 21.4 | win (21.3m) |
| 207 | win | 25.7 | win (25.9m) |
| 208 | win | 26.4 | win (26.8m) |
| 209 | win | 27.2 | win (25.1m) |
| 210 | win | 30.6 | win (28.9m) |
| 211 | win | 25.8 | win (28.9m) |
| 212 | win | 31.7 | win (33.3m) |
| 213 | win | 27.0 | win (27.0m) |
| 214 | win | 23.2 | win (23.2m) |
| 215 | timeout | 45.0 | timeout (45.0m) |
| 216 | win | 24.1 | win (24.4m) |
| 217 | win | 23.6 | win (23.0m) |
| 218 | win | 28.0 | win (28.0m) |
| 219 | win | 34.3 | win (36.4m) |
| 220 | win | 23.2 | win (23.1m) |
| 221 | win | 34.0 | win (35.3m) |
| 222 | win | 23.6 | win (26.4m) |
| 223 | win | 31.7 | win (33.1m) |
| 224 | win | 24.1 | win (24.1m) |
| 225 | win | 28.2 | win (30.0m) |
| 226 | win | 25.0 | win (23.7m) |
| 227 | win | 23.1 | win (24.1m) |
| 228 | win | 33.0 | win (31.9m) |
| 229 | win | 24.1 | win (24.3m) |
| 230 | timeout | 45.0 | timeout (45.0m) |
| 231 | win | 24.0 | win (24.1m) |
| 232 | win | 35.3 | win (38.0m) |
| 233 | win | 27.2 | win (36.1m) |
| 234 | win | 25.5 | win (26.8m) |
| 235 | win | 24.0 | win (23.7m) |
| 236 | win | 25.4 | win (26.8m) |
| 237 | win | 27.3 | win (28.0m) |
| 238 | win | 27.1 | win (27.0m) |
| 239 | win | 29.6 | win (26.0m) |
| 240 | win | 29.3 | win (32.1m) |
| 241 | win | 33.4 | win (36.7m) |
| 242 | win | 24.3 | win (24.2m) |
| 243 | win | 26.5 | win (28.6m) |
| 244 | loss | 33.0 | win (44.4m) |
| 245 | win | 28.0 | win (28.0m) |
| 246 | win | 24.0 | win (24.3m) |
| 247 | win | 36.0 | win (34.4m) |
| 248 | win | 23.0 | win (23.0m) |
| 249 | win | 27.3 | win (28.7m) |
| 250 | win | 19.7 | win (20.0m) |
| 251 | win | 24.2 | win (26.0m) |
| 252 | win | 23.3 | win (22.0m) |
| 253 | win | 20.7 | win (21.4m) |
| 254 | win | 27.0 | win (28.0m) |
| 255 | win | 23.3 | win (23.0m) |
| 256 | win | 28.0 | win (28.8m) |
| 257 | win | 28.6 | win (30.0m) |
| 258 | win | 23.6 | win (26.3m) |
| 259 | win | 33.7 | win (31.6m) |
| 260 | win | 24.2 | win (24.2m) |
| 261 | win | 20.3 | win (21.4m) |
| 262 | win | 24.3 | win (26.9m) |
| 263 | loss | 43.0 | timeout (45.0m) |
| 264 | win | 38.0 | win (35.2m) |
| 265 | win | 26.7 | win (28.0m) |
| 266 | win | 23.8 | win (21.1m) |
| 267 | loss | 43.0 | timeout (45.0m) |
| 268 | win | 20.7 | win (22.2m) |
| 269 | win | 33.0 | win (30.7m) |
| 270 | win | 28.3 | win (30.1m) |
| 271 | win | 26.2 | win (25.0m) |
| 272 | win | 35.4 | win (38.0m) |
| 273 | win | 36.5 | win (31.7m) |
| 274 | win | 30.1 | win (31.9m) |
| 275 | win | 28.2 | win (29.0m) |
| 276 | win | 28.8 | win (28.8m) |
| 277 | win | 34.5 | win (35.1m) |
| 278 | win | 24.4 | win (24.6m) |
| 279 | win | 41.3 | loss (31.0m) |
| 280 | win | 33.0 | win (28.0m) |
| 281 | win | 29.7 | win (25.8m) |
| 282 | win | 28.0 | win (25.7m) |
| 283 | win | 25.0 | win (28.3m) |
| 284 | win | 24.3 | win (26.6m) |
| 285 | win | 44.1 | win (44.5m) |
| 286 | win | 30.3 | win (37.1m) |
| 287 | win | 25.5 | win (34.5m) |
| 288 | win | 25.5 | win (26.8m) |
| 289 | win | 26.9 | win (28.1m) |
| 290 | win | 27.1 | win (29.0m) |
| 291 | win | 29.9 | win (34.5m) |
| 292 | win | 30.7 | win (36.9m) |
| 293 | win | 29.9 | win (30.7m) |
| 294 | win | 26.5 | win (28.0m) |
| 295 | win | 34.7 | win (36.2m) |
| 296 | win | 33.4 | win (34.2m) |
| 297 | win | 21.3 | win (21.8m) |
| 298 | win | 38.7 | win (38.2m) |
| 299 | win | 24.9 | win (26.2m) |
| 300 | win | 31.2 | win (30.3m) |
| 301 | win | 33.0 | win (33.0m) |
| 302 | win | 33.0 | win (29.5m) |
| 303 | win | 28.0 | win (27.3m) |
| 304 | win | 25.1 | win (30.3m) |
| 305 | win | 29.8 | win (29.7m) |
| 306 | win | 27.4 | win (28.6m) |
| 307 | win | 25.2 | win (23.2m) |
| 308 | win | 28.0 | win (30.7m) |
| 309 | win | 26.8 | win (28.0m) |
| 310 | win | 26.1 | win (28.3m) |
| 311 | win | 35.9 | win (38.2m) |
| 312 | win | 25.4 | win (26.1m) |
| 313 | win | 25.1 | win (25.6m) |
| 314 | win | 31.3 | win (38.6m) |
| 315 | win | 24.4 | win (24.7m) |
| 316 | timeout | 45.0 | loss (35.0m) |
| 317 | win | 28.9 | win (27.4m) |
| 318 | win | 25.2 | win (26.1m) |
| 319 | win | 29.9 | win (29.9m) |
| 320 | win | 40.3 | timeout (45.0m) |
| 321 | win | 26.7 | win (33.0m) |
| 322 | win | 23.0 | win (24.4m) |
| 323 | win | 27.2 | win (26.6m) |
| 324 | win | 24.9 | win (24.7m) |
| 325 | win | 23.7 | win (23.3m) |
| 326 | win | 27.2 | win (26.9m) |
| 327 | timeout | 45.0 | win (29.0m) |
| 328 | win | 23.8 | win (23.3m) |
| 329 | win | 27.0 | win (29.0m) |
| 330 | win | 26.5 | win (26.7m) |
| 331 | win | 25.4 | win (26.1m) |
| 332 | win | 23.0 | win (23.0m) |
| 333 | win | 24.7 | win (23.1m) |
| 334 | win | 33.0 | win (33.0m) |
| 335 | win | 28.1 | win (28.2m) |
| 336 | win | 28.9 | win (28.0m) |
| 337 | win | 28.9 | win (28.8m) |
| 338 | win | 29.2 | win (27.4m) |
| 339 | win | 26.2 | win (25.4m) |
| 340 | win | 39.2 | timeout (45.0m) |
| 341 | win | 23.0 | win (23.0m) |
| 342 | win | 24.1 | win (23.5m) |
| 343 | win | 28.0 | win (28.0m) |
| 344 | win | 24.9 | win (24.3m) |
| 345 | win | 23.0 | win (28.2m) |
| 346 | win | 26.4 | win (21.4m) |
| 347 | win | 29.3 | win (29.9m) |
| 348 | win | 25.9 | win (34.1m) |
| 349 | win | 24.2 | win (23.6m) |
| 350 | win | 23.7 | win (23.7m) |
| 351 | win | 21.3 | win (21.6m) |
| 352 | win | 31.0 | timeout (45.0m) |
| 353 | win | 35.9 | win (33.9m) |
| 354 | win | 22.1 | win (21.8m) |
| 355 | win | 28.4 | win (25.2m) |
| 356 | timeout | 45.0 | loss (36.4m) |
| 357 | win | 24.6 | win (29.8m) |
| 358 | win | 26.1 | win (28.8m) |
| 359 | win | 26.3 | win (26.4m) |
| 360 | win | 30.9 | win (38.1m) |
| 361 | win | 34.1 | win (35.1m) |
