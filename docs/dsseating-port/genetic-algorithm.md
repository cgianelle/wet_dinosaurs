# DSSeating: The Genetic Algorithm and Its Techniques

**Version:** 1.0
**Source:** *Use of Genetic Algorithm in Class Room Seating* (SWENG 584, Penn State), Chris Gianelle and Sunil Lobo — `DSSeating_10_10_03/SWENG584_GA_ClassRoomDistribution_V0003.pdf`

This document summarizes the genetic algorithm (GA) behind the original Java DSSeating program (Borland JBuilder 8/9, Windows 2000/XP) and the techniques used to build it. It is background for the Go port.

## 1. The problem

A 2nd-grade teacher must seat **20 students** in a classroom of **5 rows × 4 columns**, subject to:

| # | Constraint | Test data |
|---|------------|-----------|
| i | Several students request the front row (only 4 seats exist) | A, D, F, I, L, P, R (7 students) |
| ii | One student must sit on the outside aisle (column 1 or 4) | F |
| iii | Three students must not sit near one another | Q, R, S |

The constraints cannot all be met perfectly (7 front-row requests vs. 4 seats), so this is an optimization problem, not a satisfiability one.

## 2. Encoding

- **Alphabetic, permutation encoding.** Each student is a letter `A`–`T`. A chromosome is a permutation of all 20 letters, read row by row from seat (1,1) to (5,4). Every student has exactly one desk, so a valid chromosome never repeats or omits a student.
- **Genes are rows.** The chromosome is five 4-letter genes, e.g. `(A B C D)(E F G H)(I J K L)(M N O P)(Q R S T)`. Gene *n* is row *n*, and the position within the gene is the column.
- **Phenotype** is the 5×4 seating grid built from the chromosome.

Because every chromosome is a permutation, the operators below are all permutation-preserving ones.

## 3. Fitness function

Three rules are scored per chromosome:

**Sit in front** (per requesting student, by row)

| Row | Score |
|-----|-------|
| 1 | +10 |
| 2 | +7 |
| 3 | 0 |
| 4 | −10 |
| 5 | −10 |

**Cannot sit near** — "distance apart" between two students at (r₁,c₁) and (r₂,c₂) is `(|Δrow| + |Δcol|) / 2`. A distance of 1 or less is a violation (score ×−10); greater than 1 is satisfied (score ×10). Larger distances are rewarded more, so the GA prefers to push the separated students far apart.

**Must sit on outside aisle** — column 1 or 4 gives +10, otherwise −10.

**Weighted combination**

```
F = (FrontRow + SitNear) * 60%
  + (FrontRow + Aisle)   * 10%
  + (SitNear  + Aisle)   * 10%
  +  FrontRow * 4%
  +  SitNear  * 4%
  +  Aisle    * 2%
```

The weights come from interviews with other teachers: front-row placement and separating particular students are common needs, while aisle seating is rare (typically for handicapped students or leg injuries). Those two rules therefore dominate the score.

## 4. Selection

The authors took a "statistical approach", observing which events occurred most often and weighting design effort accordingly. Selection decides the mating pairs, so it received the most attention. Four operators were built, population size 100:

- **Random** — mating pairs chosen at random.
- **Queen Bee** — from the Queen-Bee Evolution paper (S.H. Jung, 2003). Find the single fittest individual (the queen) and mate her with 50 randomly chosen others, giving 50 mating pairs.
- **Plague** — a variation on the generation gap. Kill the lowest-fit individuals according to a **kill rate** parameter, then clone the survivors to refill the population. Strongly greedy, driving convergence.
- **BeePlague** — Plague first, then Queen Bee on the survivors, so the queen mates with the top individuals of each generation. The most greedy option.

## 5. Recombination

### Crossover

- **PMX (Partially Matched Crossover)** — a permutation-safe operator. The swapped segment is one gene (4 students).
- **CX (Cyclic Crossover)** — preserves positions inherited from the parents by following cycles. The cycle always started at the first position.
- **Heuristic crossover (attempted, abandoned)** — inspired by Dr. Walter Cedeño. Keep alleles that sit at the same position in both parents, then fill the rest with *best fit* (child 1, filling by seating criteria) and *first fit* / alphabetical order (child 2). The authors underestimated how rarely two parents agree on a position, so the operator ended up building a problem-informed individual almost every time instead of recombining. They concluded CX plus a best-fit fill would have been a better route.

### Mutation

**Inversion** — per individual, with probability *Pm*. Two cut points are chosen and the alleles between them are reversed. Mutation got less design emphasis than selection.

## 6. Replacement

- **100% generational replacement** for Random and Queen Bee.
- For Plague and BeePlague the replacement amount follows from the **kill rate**.

## 7. Results

The test set was the original problem above. The authors expected selection to matter most and CX to preserve good parental traits.

- **Selection mattered.** The greedy methods (Plague, BeePlague) outperformed Random and basic Queen Bee.
- **CX converged prematurely.** Most runs locked at a fitness of **96.92**, with one run reaching 99.14. The cause: the cycle always started at position 1, so the queen's (or dominant individual's) leading genes were copied to offspring every time, and only mutation could break the pattern. Best individual: `RADFILPQBCEGHJKMNOST`. Both 96.92 strings satisfied all three constraints.
- **PMX scored highest.** Its reordering gave more population variance, and convergence came later (no earlier than generation 10). It converged at 106.54 under BeePlague (kill rates 50 and 75) and at 91.74 / 99.14 under Plague (50 / 75).
- **PMX's top scorers were invalid.** `APLRFDITNKJBMGOEQSHC` and `IPARFLDKEHNMCOBTQSJG` put Q and S adjacent. The reward for R being far from Q and S outweighed the penalty (only −10) for the adjacency violation.

## 8. Conclusions and future work

- Vary the **CX starting point** per mating pair, and vary the **PMX segment size** per crossover, to keep population diversity up and avoid premature convergence.
- Add a **"Village Idiot"** — the reciprocal of the Queen Bee: when convergence looms, inject the *least* fit individual for one generation to lower average fitness and break the lock-in.
- **Switch selection schemes** each time a new mating pool is chosen.
- **Strengthen penalties**, since violations were under-punished relative to the rewards.
- The approach generalizes to other seating problems (e.g. wedding receptions) by swapping front-row and aisle rules for age, sex, family, and preference rules analogous to *sits near*.

## 9. Technique summary

| Area | Technique |
|------|-----------|
| Encoding | Alphabetic permutation; genes = rows |
| Fitness | Rule-based scoring, weighted blend (60/10/10/4/4/2) |
| Selection | Random, Queen Bee, Plague (kill rate), BeePlague |
| Crossover | PMX (gene-sized segment), CX; heuristic crossover tried and dropped |
| Mutation | Inversion with per-individual probability *Pm* |
| Replacement | 100% generational; kill-rate-based for Plague variants |
| Known weaknesses | Premature convergence (CX), under-penalized violations (PMX) |

## References

- Melanie Mitchell, *An Introduction to Genetic Algorithms*, 2002.
- S.H. Jung, "Queen-Bee Evolution for Genetic Algorithms", *Electronics Letters* (IEE), 20 March 2003, pp. 575–576.
- Dr. Walter Cedeño, heuristic crossover idea.
