"""
GET 210 Code Assessment - numerical computation engine.

Given a 9-digit matriculation number, derives the student's unique
parameters (D, S, Y0), solves Question 1 (Euler vs Heun, h=0.1 and h=0.2,
convergence order) and Question 2 (damped Heun vs exact analytical
solution), and emits everything as JSON on stdout for the Express backend.
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


def main():
    matric = sys.argv[1]
    D, S, Y0 = parse_matric(matric)

    t_sym = sp.symbols("t")
    y_fn = sp.Function("y")

    # ---------- Question 1: dy/dt = y - t^2 + 1 ----------
    ode1 = sp.Eq(y_fn(t_sym).diff(t_sym), y_fn(t_sym) - t_sym**2 + 1)
    sol1 = sp.dsolve(ode1, y_fn(t_sym), ics={y_fn(0): Y0})
    exact1_expr = sp.simplify(sol1.rhs)
    exact1 = sp.lambdify(t_sym, exact1_expr, "numpy")

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
              markersize=3, label="Euler (h=0.1)")
    ax1.plot(q1_runs[0.1]["heun_t"], q1_runs[0.1]["heun_y"], "s--",
              markersize=3, label="Heun (h=0.1)")
    ax1.set_xlabel("t")
    ax1.set_ylabel("y")
    ax1.set_title(f"Question 1:  dy/dt = y - t² + 1,   y(0) = {Y0}")
    ax1.legend()
    ax1.grid(alpha=0.3)
    q1_plot = fig_to_base64(fig1)

    # ---------- Question 2: dy/dt = -K y - t^2 + 1 ----------
    K = D
    ode2 = sp.Eq(y_fn(t_sym).diff(t_sym), -K * y_fn(t_sym) - t_sym**2 + 1)
    sol2 = sp.dsolve(ode2, y_fn(t_sym), ics={y_fn(0): Y0})
    exact2_expr = sp.simplify(sol2.rhs)
    exact2 = sp.lambdify(t_sym, exact2_expr, "numpy")

    f2 = lambda t, y: -K * y - t**2 + 1
    th2, yh2 = heun(f2, Y0, 0, 2, 0.2)
    exact2_vals = [float(exact2(tt)) for tt in th2]
    errors2 = [abs(e - float(y)) for e, y in zip(exact2_vals, yh2.tolist())]

    # Heun/RK2 linear stability on the homogeneous part y' = -Ky:
    # growth factor R(z) = 1 + z + z^2/2 with z = -K*h; stable iff |R(z)| <= 1,
    # which on the negative real axis holds for z in [-2, 0], i.e. h <= 2/K.
    h2 = 0.2
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

    output = {
        "params": {"D": D, "S": S, "Y0": Y0, "matric": matric},
        "q1": {
            "exact_formula": str(exact1_expr),
            "exact_latex": sp.latex(exact1_expr),
            "exact_final": float(exact1(2.0)),
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
            "exact_formula": str(exact2_expr),
            "exact_latex": sp.latex(exact2_expr),
            "t": th2.tolist(),
            "heun_y": yh2.tolist(),
            "exact_y": exact2_vals,
            "errors": errors2,
            "max_error": float(max(errors2)),
            "final_error": float(errors2[-1]),
            "stability": stability,
            "plot": q2_plot,
        },
    }
    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - surfaced to the API caller
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
