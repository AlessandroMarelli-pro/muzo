import { Button } from './ui/button';

export const NoData = ({
  Icon,
  title,
  subtitle,
  buttonAction,
  buttonLabel,
  ButtonIcon,
}: {
  Icon: React.ElementType;
  title: string;
  subtitle: string;
  buttonAction?: () => void;
  buttonLabel?: string;
  ButtonIcon?: React.ElementType;
}) => {
  return (
    <div className="text-center  flex flex-col items-center justify-center h-full">
      <div className="mx-auto w-24 h-24 bg-primary-foreground dark:bg-primary rounded-full flex items-center justify-center mb-4">
        <Icon className="h-12 w-12 text-primary dark:text-primary-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-primary-foreground dark:text-primary mb-2">
        {title}
      </h3>
      <p className="text-secondary-foreground dark:text-primary/80 mb-6">
        {subtitle}
      </p>
      {buttonAction && (
        <Button variant="outline" onClick={buttonAction}>
          {ButtonIcon && <ButtonIcon className="h-4 w-4 mr-2" />}
          {buttonLabel}
        </Button>
      )}
    </div>
  );
};
