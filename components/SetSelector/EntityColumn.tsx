import { ReactNode, useState } from "react";
import NeonButton from "../NeonButton";

type EntityColumnProps = {
  selector: ReactNode;
  renderForm: (onDone: () => void) => ReactNode;
  addButtonText: string;
  isVisible: boolean;
};

export default function EntityColumn({
  selector,
  renderForm,
  addButtonText,
  isVisible,
}: EntityColumnProps) {
  const [showForm, setShowForm] = useState(false);

  const handleFormDone = () => {
    setShowForm(false);
  };

  if (!isVisible) return null;

  return (
    <div className="min-w-[260px] flex flex-col gap-4">
      {selector}
      {showForm ? (
        renderForm(handleFormDone)
      ) : (
        <NeonButton onClick={() => setShowForm(true)}>
          {addButtonText}
        </NeonButton>
      )}
    </div>
  );
}
