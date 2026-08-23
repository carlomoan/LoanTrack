'use client';

import * as React from 'react';
import {
  useForm,
  FormProvider,
  useFormContext,
  Controller,
  type Control,
  type FieldValues,
  type FormState,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export { useForm, FormProvider, useFormContext, Controller };
export { zodResolver } from '@hookform/resolvers/zod';
export { z } from 'zod';

// ✅ This fixes: 'Form' is not exported from '@/components/ui/form'
const Form = FormProvider;

interface FormFieldProps<T extends FieldValues = FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  render: (props: {
    field: {
      onChange: (value: any) => void;
      onBlur: () => void;
      value: any;
      name: string;
      ref: React.Ref<any>;
    };
    fieldState: {
      error?: { message?: string } | undefined;
      isDirty: boolean;
      isTouched: boolean;
    };
    formState: FormState<T>;
  }) => React.ReactElement; // ✅ Fixed: Changed from ReactNode to ReactElement
}

function FormField<T extends FieldValues = FieldValues>({
  control,
  name,
  render,
}: FormFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) =>
        render({ field, fieldState, formState })
      }
    />
  );
}

interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {}

const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2', className)} {...props} />
  )
);
FormItem.displayName = 'FormItem';

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, ...props }, ref) => (
    <Label ref={ref} className={cn('', className)} {...props} />
  )
);
FormLabel.displayName = 'FormLabel';

interface FormControlProps extends React.HTMLAttributes<HTMLDivElement> {}

const FormControl = React.forwardRef<HTMLDivElement, FormControlProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
);
FormControl.displayName = 'FormControl';

interface FormDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  FormDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
FormDescription.displayName = 'FormDescription';

interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, ...props }, ref) => {
    // ✅ Fixed: Handle undefined children to prevent ReactNode assignment errors
    if (!children) return null;
    return (
      <p
        ref={ref}
        className={cn('text-sm font-medium text-destructive', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
FormMessage.displayName = 'FormMessage';

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
};
