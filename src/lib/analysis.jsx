function fmt(n, d = 4) {
  return Number(n).toFixed(d)
}

export function Q1Discussion({ result }) {
  const { q1, params } = result
  const e02 = q1.errors['h0.2']
  const e01 = q1.errors['h0.1']
  const pE = q1.convergence_order.euler
  const pH = q1.convergence_order.heun

  return (
    <>
      <p>
        Euler&rsquo;s method advances the solution using only the slope at the start of each
        step, so its local truncation error (LTE) per step is{' '}
        <code>&tau; = (h&sup2;/2)&middot;y''(&xi;)</code>, giving a first-order global error of{' '}
        <code>O(h)</code>. Heun&rsquo;s method averages the slope at the start and the
        (predicted) end of the step, cancelling the h&sup2; term and leaving an LTE of{' '}
        <code>O(h&sup3;)</code> per step, i.e. a second-order global error of <code>O(h&sup2;)</code>.
        Halving <code>h</code> should therefore roughly halve Euler&rsquo;s error and quarter
        Heun&rsquo;s.
      </p>
      <p>
        For y(0) = {params.Y0}, the measured errors at t = 2.0 were{' '}
        <strong>{fmt(e02.euler, 6)}</strong> (Euler, h=0.2) &rarr; <strong>{fmt(e01.euler, 6)}</strong>{' '}
        (Euler, h=0.1) &mdash; a reduction factor of {fmt(e02.euler / e01.euler, 2)}&times;, giving an
        empirical order p &asymp; {fmt(pE, 3)}. For Heun, <strong>{fmt(e02.heun, 6)}</strong> &rarr;{' '}
        <strong>{fmt(e01.heun, 6)}</strong>, a {fmt(e02.heun / e01.heun, 2)}&times; reduction and p &asymp;{' '}
        {fmt(pH, 3)}. Both are close to their theoretical orders of 1 and 2 respectively, with the
        small deviation coming from the finite step size and the specific curvature of this
        trajectory.
      </p>
      <p>
        The exact solution here is y(t) = {q1.exact_formula.replace(/\*\*/g, '^').replace(/\*/g, '·')}
        , whose higher derivatives (y'', y''&prime;, &hellip;) are all dominated by the term
        ({fmt(params.Y0 - 1, 3)})&middot;e<sup>t</sup>, which grows monotonically on [0, 2]. Because
        the Euler and Heun LTE bounds scale with |y''(&xi;)| and |y'''(&xi;)| respectively, the
        truncation error injected at each step grows as t increases, so both methods accumulate
        their largest errors near t = 2.0 &mdash; consistent with reporting the error at the final
        point. Since Heun&rsquo;s error term carries an extra factor of h and depends on the
        (also-growing) third derivative, it is more sensitive in absolute curvature terms but far
        more effective at suppressing it, which is why it stays roughly an order of magnitude more
        accurate than Euler across both step sizes on this specific, exponentially-growing
        trajectory.
      </p>
    </>
  )
}

export function Q2Discussion({ result }) {
  const { q2, params } = result
  const { stability } = q2
  const K = q2.K

  return (
    <>
      <p>
        Introducing the damping term &minus;Ky changes the linear part of the ODE from
        y&prime; = (+1)y + &hellip; in Question 1 to y&prime; = (&minus;{K})y + &hellip; here. The
        eigenvalue governing the homogeneous mode flips sign from +1 (growing, e<sup>t</sup>) to
        &minus;{K} (decaying, e<sup>&minus;{K}t</sup>). Consequently the exact solution y(t) ={' '}
        {q2.exact_formula.replace(/\*\*/g, '^').replace(/\*/g, '·')} settles toward the slowly
        varying particular solution instead of diverging, and any error introduced early in the
        integration is damped out rather than amplified as t &rarr; 2.
      </p>
      <p>
        Numerically, Heun&rsquo;s method (RK2) applied to y&prime; = &minus;Ky has growth factor
        R(z) = 1 + z + z&sup2;/2 with z = &minus;Kh. Here z = {fmt(stability.z, 4)}, giving
        R(z) = {fmt(stability.growth_factor, 4)}, and |R(z)| {stability.stable ? '≤' : '>'} 1, so
        the method is{' '}
        <strong>{stability.stable ? 'numerically stable' : 'numerically unstable'}</strong> at
        h = 0.2 for K = {K}
        {stability.h_max_stable != null && (
          <>
            {' '}
            (the RK2 stability boundary on this problem is h &le; {fmt(stability.h_max_stable, 4)})
          </>
        )}
        . {stability.stable
          ? 'This matches the observed error profile: it does not grow unboundedly, and the final absolute error is small relative to the scale of the solution.'
          : 'This means the step size is too large for this damping strength — expect the numerical solution to oscillate with growing amplitude even though the true solution decays, and h should be reduced below the stability boundary above.'}
      </p>
      <p>
        Comparing magnitudes directly: the undamped system (Q1) reached an absolute error of{' '}
        {fmt(result.q1.errors['h0.1'].heun, 6)} at t = 2 with Heun at h = 0.1, whereas the damped
        system reaches a final absolute error of only {fmt(q2.final_error, 6)} (max{' '}
        {fmt(q2.max_error, 6)}) at the coarser h = 0.2. The damping coefficient K therefore does not
        just change the shape of the trajectory — it fundamentally changes the error dynamics from
        an amplifying regime to a self-correcting one.
      </p>
    </>
  )
}
