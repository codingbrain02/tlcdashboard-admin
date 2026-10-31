import type { ComponentProps } from 'react'
import PhoneInput from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import 'react-phone-number-input/style.css'

export default function CountryPhoneInput(props: ComponentProps<typeof PhoneInput>) {
  return <PhoneInput {...props} flags={flags} />
}
