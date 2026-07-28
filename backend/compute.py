"""
GET 210 Code Assessment - numerical computation engine.

Given a 9-digit matriculation number, derives the student's unique
parameters (D, S, Y0), solves Question 1 (Euler vs Heun, h=0.1 and h=0.2,
convergence order) and Question 2 (damped Heun vs exact analytical
solution), and emits everything as JSON on stdout for the Express backend.

Both questions share the same ODE family — y' + p*y = 1 - t^2 — with p = -1
for Question 1 (undamped/growing) and p = K for Question 2 (damped). The
exact solution is derived analytically via undetermined coefficients (not
just solved numerically), and every intermediate step of that derivation is
returned so the frontend can render a full worked solution, not just the
final formula.
"""

import sys
import json
import base64
import io

import numpy as np
import sympy as sp

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def parse_matric(matric):
    if len(matric) != 9 or not matric.isdigit():
        raise ValueError("Matriculation number must be exactly 9 digits.")
    D = int(matric[4:6])
    S = int(matric[6:9])
    Y0 = D + S / 1000
    return D, S, Y0


def euler(f, y0, t0, tend, h):
    n = int(round((tend - t0) / h))
    t, y = t0, y0
    ts, ys = [t], [y]
    for _ in range(n):
        y = y + h * f(t, y)
        t = t + h
        ts.append(t)
        ys.append(y)
    return np.array(ts), np.array(ys)


def heun(f, y0, t0, tend, h):
    n = int(round((tend - t0) / h))
    t, y = t0, y0
    ts, ys = [t], [y]
    for _ in range(n):
        k1 = f(t, y)
        y_pred = y + h * k1
        k2 = f(t + h, y_pred)
        y = y + (h / 2) * (k1 + k2)
        t = t + h
        ts.append(t)
        ys.append(y)
    return np.array(ts), np.array(ys)


def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ---------- Shared analytical derivation: y' + p*y = 1 - t^2, y(0) = Y0 ----------
#
# Solved once, symbolically, in terms of the free parameter p so the same
# machinery derives both Question 1 (p = -1) and Question 2 (p = K) — the
# undetermined-coefficients algebra is identical, only p differs.

def _prettiest(expr):
    """Return whichever of factor()/simplify() is structurally simplest —
    factor() turns t^2+2t+1 into the much more readable (t+1)^2, but on
    expressions with no clean common factor it can make things *uglier*
    (e.g. forcing everything over a common denominator), so try both and
    keep whichever has fewer operations. (Comparing rendered LaTeX length
    doesn't work here: sympy's \\left(...\\right) delimiters make compact
    factored forms look "longer" as source text than they render.)"""
    candidates = [expr]
    try:
        candidates.append(sp.factor(expr))
    except Exception:
        pass
    try:
        candidates.append(sp.simplify(expr))
    except Exception:
        pass
    return min(candidates, key=sp.count_ops)


_t, _p, _a, _b, _c, _C, _Y0 = sp.symbols("t p a b c C Y0")

_yp_trial = _a * _t**2 + _b * _t + _c
_lhs = sp.diff(_yp_trial, _t) + _p * _yp_trial
_rhs = 1 - _t**2

# Match coefficients of t^2, t, 1 on both sides (undetermined coefficients).
_coeff_eqs = [sp.Eq(coef, 0) for coef in sp.Poly(sp.expand(_lhs - _rhs), _t).all_coeffs()]
_coeffs_general = sp.solve(_coeff_eqs, [_a, _b, _c], dict=True)[0]

_yp_general = _yp_trial.subs(_coeffs_general)
_y_gen_general = _C * sp.exp(-_p * _t) + _yp_general
_C_general = sp.solve(sp.Eq(_y_gen_general.subs(_t, 0), _Y0), _C)[0]


def derive_exact_solution(p_val, Y0_val):
    """Full step-by-step derivation of y' + p*y = 1 - t^2, y(0) = Y0.

    Every field is a plain Python-expression string (e.g. "t**2 + 2*t + 1"),
    matching the existing exact_formula convention — the frontend prettifies
    these for display via the same formatFormula() regex helper it already
    uses (** -> ^, * -> ·, exp -> e^). There's no LaTeX renderer in the app,
    so LaTeX strings would just show raw backslashes.
    """
    if p_val == 0:
        # Degenerate case (no damping/growth term): directly integrable.
        yp_num = sp.integrate(_rhs, _t)
        C_val = float(Y0_val - yp_num.subs(_t, 0))
        y_final_num = sp.simplify(yp_num + C_val)
        return {
            "p": float(p_val),
            "degenerate": True,
            "standard_form_str": "dy/dt = 1 - t**2",
            "homogeneous_str": "C",
            "particular_trial_str": None,
            "matching_equation_str": None,
            "coefficients": None,
            "particular_solution_str": str(sp.simplify(yp_num)),
            "general_solution_str": f"C + {yp_num}",
            "c_value": None,
            "C_value": C_val,
            "final_solution_str": str(y_final_num),
            "final_solution_func": sp.lambdify(_t, y_final_num, "numpy"),
        }

    coeffs_num = {k: v.subs(_p, p_val) for k, v in _coeffs_general.items()}
    a_val = float(coeffs_num[_a])
    b_val = float(coeffs_num[_b])
    c_val = float(coeffs_num[_c])

    yp_num = _prettiest(sp.expand(_yp_general.subs(_p, p_val)))

    # Built by hand rather than from str(Eq(...)) — sympy's automatic term
    # ordering renders "y' - y = ..." as the equivalent but less
    # conventional "-y + y' = ...".
    p_display = sp.nsimplify(p_val)
    if p_val == -1:
        standard_form_str = "dy/dt - y = 1 - t**2"
    elif p_val > 0:
        standard_form_str = f"dy/dt + {p_display}*y = 1 - t**2"
    else:
        standard_form_str = f"dy/dt + ({p_display})*y = 1 - t**2"

    matching_lhs = sp.expand(_lhs.subs(_p, p_val))
    matching_rhs = sp.expand(_rhs)
    matching_equation_str = f"{matching_lhs} = {matching_rhs}"

    homogeneous = _C * sp.exp(-p_val * _t)
    general_solution = homogeneous + yp_num

    C_val = float(_C_general.subs({_p: p_val, _Y0: Y0_val}))
    # Built compositionally from the already-prettified homogeneous and
    # particular pieces, rather than re-simplifying the fully expanded sum —
    # factor() can't usefully factor an exponential term and a polynomial
    # term together, so simplifying the combined sum just re-expands (t+1)^2
    # back out. This keeps the boxed final answer in the same "C·e^(-pt) +
    # (nice particular solution)" shape used throughout the derivation.
    y_final_num = homogeneous.subs(_C, C_val) + yp_num

    return {
        "p": float(p_val),
        "degenerate": False,
        "standard_form_str": standard_form_str,
        "homogeneous_str": str(homogeneous),
        "particular_trial_str": str(_yp_trial),
        "matching_equation_str": matching_equation_str,
        "coefficients": {"a": a_val, "b": b_val, "c": c_val},
        "particular_solution_str": str(yp_num),
        "general_solution_str": str(general_solution),
        "c_value": c_val,
        "C_value": C_val,
        "final_solution_str": str(y_final_num),
        "final_solution_func": sp.lambdify(_t, y_final_num, "numpy"),
    }


def main():
    matric = sys.argv[1]
    D, S, Y0 = parse_matric(matric)

    # ---------- Question 1: dy/dt = y - t^2 + 1  (i.e. y' + (-1)y = 1 - t^2) ----------
    deriv1 = derive_exact_solution(-1, Y0)
    exact1 = deriv1["final_solution_func"]

    f1 = lambda t, y: y - t**2 + 1

    q1_runs = {}
    for h in (0.2, 0.1):
        te, ye = euler(f1, Y0, 0, 2, h)
        th, yh = heun(f1, Y0, 0, 2, h)
        q1_runs[h] = {
            "euler_final": float(ye[-1]),
            "heun_final": float(yh[-1]),
            "euler_error": abs(float(exact1(2.0)) - float(ye[-1])),
            "heun_error": abs(float(exact1(2.0)) - float(yh[-1])),
            "euler_t": te.tolist(),
            "euler_y": ye.tolist(),
            "heun_t": th.tolist(),
            "heun_y": yh.tolist(),
        }

    def order(h_coarse, h_fine, key):
        e_coarse = q1_runs[h_coarse][key]
        e_fine = q1_runs[h_fine][key]
        if e_fine <= 0:
            return None
        return float(np.log(e_coarse / e_fine) / np.log(h_coarse / h_fine))

    order_euler = order(0.2, 0.1, "euler_error")
    order_heun = order(0.2, 0.1, "heun_error")

    fig1, ax1 = plt.subplots(figsize=(7, 5))
    t_fine = np.linspace(0, 2, 400)
    ax1.plot(t_fine, exact1(t_fine), "k-", linewidth=2, label="Exact")
    ax1.plot(q1_runs[0.1]["euler_t"], q1_runs[0.1]["euler_y"], "o--",
              color="tab:red", markersize=4, label="Euler (h=0.1)")
    ax1.plot(q1_runs[0.1]["heun_t"], q1_runs[0.1]["heun_y"], "s--",
              color="tab:blue", markersize=4, label="Heun (h=0.1)")
    ax1.plot(q1_runs[0.2]["euler_t"], q1_runs[0.2]["euler_y"], "^:",
              color="tab:orange", markersize=5, label="Euler (h=0.2)")
    ax1.plot(q1_runs[0.2]["heun_t"], q1_runs[0.2]["heun_y"], "d:",
              color="tab:green", markersize=5, label="Heun (h=0.2)")
    ax1.set_xlabel("t")
    ax1.set_ylabel("y")
    ax1.set_title(f"Question 1:  dy/dt = y - t² + 1,   y(0) = {Y0}")
    ax1.legend()
    ax1.grid(alpha=0.3)
    q1_plot = fig_to_base64(fig1)

    # ---------- Question 2: dy/dt = -K y - t^2 + 1  (i.e. y' + K y = 1 - t^2) ----------
    K = D
    deriv2 = derive_exact_solution(K, Y0)
    exact2 = deriv2["final_solution_func"]

    f2 = lambda t, y: -K * y - t**2 + 1
    h2 = 0.2
    th2, yh2 = heun(f2, Y0, 0, 2, h2)
    exact2_vals = [float(exact2(tt)) for tt in th2]
    errors2 = [abs(e - float(y)) for e, y in zip(exact2_vals, yh2.tolist())]

    # Heun/RK2 linear stability on the homogeneous part y' = -Ky:
    # growth factor R(z) = 1 + z + z^2/2 with z = -K*h; stable iff |R(z)| <= 1,
    # which on the negative real axis holds for z in [-2, 0], i.e. h <= 2/K.
    z_stab = -K * h2
    growth_factor = 1 + z_stab + z_stab**2 / 2
    stability = {
        "z": float(z_stab),
        "growth_factor": float(growth_factor),
        "stable": bool(abs(growth_factor) <= 1),
        "h_max_stable": (2 / K) if K > 0 else None,
    }

    fig2, ax2 = plt.subplots(figsize=(7, 5))
    t_fine2 = np.linspace(0, 2, 400)
    ax2.plot(t_fine2, [float(exact2(tt)) for tt in t_fine2], "k-",
              linewidth=2, label="Exact")
    ax2.plot(th2, yh2, "o--", color="tab:red", markersize=4,
              label="Heun (h=0.2)")
    ax2.set_xlabel("t")
    ax2.set_ylabel("y")
    ax2.set_title(f"Question 2:  dy/dt = -{K}y - t² + 1,   y(0) = {Y0}")
    ax2.legend()
    ax2.grid(alpha=0.3)
    q2_plot = fig_to_base64(fig2)

    # Absolute error profile vs t — shows error decaying rather than growing.
    fig2b, ax2b = plt.subplots(figsize=(7, 4))
    ax2b.plot(th2, errors2, "o-", color="tab:red")
    ax2b.set_xlabel("t")
    ax2b.set_ylabel("Absolute error")
    ax2b.set_title("Question 2: Absolute Error Profile of Heun Approximation vs t")
    ax2b.grid(alpha=0.3)
    q2_error_plot = fig_to_base64(fig2b)

    def derivation_json(d):
        return {k: v for k, v in d.items() if k not in ("final_solution_func",)}

    output = {
        "params": {"D": D, "S": S, "Y0": Y0, "matric": matric},
        "q1": {
            "exact_formula": deriv1["final_solution_str"],
            "exact_final": float(exact1(2.0)),
            "derivation": derivation_json(deriv1),
            "errors": {
                "h0.2": {"euler": q1_runs[0.2]["euler_error"], "heun": q1_runs[0.2]["heun_error"]},
                "h0.1": {"euler": q1_runs[0.1]["euler_error"], "heun": q1_runs[0.1]["heun_error"]},
            },
            "final_values": {
                "h0.2": {"euler": q1_runs[0.2]["euler_final"], "heun": q1_runs[0.2]["heun_final"]},
                "h0.1": {"euler": q1_runs[0.1]["euler_final"], "heun": q1_runs[0.1]["heun_final"]},
            },
            "convergence_order": {"euler": order_euler, "heun": order_heun},
            "series": {
                "h0.1": {
                    "t": q1_runs[0.1]["euler_t"],
                    "euler_y": q1_runs[0.1]["euler_y"],
                    "heun_y": q1_runs[0.1]["heun_y"],
                    "exact_y": [float(exact1(tt)) for tt in q1_runs[0.1]["euler_t"]],
                }
            },
            "plot": q1_plot,
        },
        "q2": {
            "K": K,
            "exact_formula": deriv2["final_solution_str"],
            "derivation": derivation_json(deriv2),
            "t": th2.tolist(),
            "heun_y": yh2.tolist(),
            "exact_y": exact2_vals,
            "errors": errors2,
            "max_error": float(max(errors2)),
            "final_error": float(errors2[-1]),
            "stability": stability,
            "plot": q2_plot,
            "error_plot": q2_error_plot,
        },
    }
    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - surfaced to the API caller
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
