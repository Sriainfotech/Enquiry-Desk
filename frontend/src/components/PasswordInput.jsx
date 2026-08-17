import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputCls, inputErrCls } from "./ui";

export default function PasswordInput({ value, onChange, error, className, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={(error ? inputErrCls : inputCls) + " pr-10 " + (className || "")}
        value={value}
        onChange={onChange}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
