function valCPF(cpf) {
    if(cpf == '') return false;
    
    if (cpf.length != 11)
        return false;

    if (cpf == "00000000000" || 
        cpf == "11111111111" || 
        cpf == "22222222222" || 
        cpf == "33333333333" || 
        cpf == "44444444444" || 
        cpf == "55555555555" || 
        cpf == "66666666666" || 
        cpf == "77777777777" || 
        cpf == "88888888888" || 
        cpf == "99999999999")
        return false;

    return true;
}
function valTel(tel) {
    if(tel == '') return false;

    if (tel.length != 11)
        return false;

    if (tel == "000000000" || 
        tel == "111111111" || 
        tel == "222222222" || 
        tel == "333333333" || 
        tel == "444444444" || 
        tel == "555555555" || 
        tel == "666666666" || 
        tel == "777777777" || 
        tel == "888888888" || 
        tel == "999999999")
        return false;
        
    return true;
}
function valSenha(senhan) {
    if(senhan == '') return false;

    body('senha')
    .isLength({ min: 6, max: 20 }).withMessage('A senha deve conter de 6 a 20 caracteres!')
    .custom((value, { req }) => {
      const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).$/;
      if (!regex.test(value)) {
        throw new Error('A senha deve conter pelo menos um número, uma letra maiúscula e um caractere especial!');
      }
      return true;
    })
}
function valCsenha(csenha) {
    if(csenha !== senhan) return false;
}
module.exports = { valCPF, valTel, valSenha, valCsenha};