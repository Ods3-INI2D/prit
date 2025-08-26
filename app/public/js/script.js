$(document).ready(function () {
    $("#btn").click(function () {
      $.ajax({
        type: "POST",
        url: "/cadastro",
        data: {
          'nome': $("#nome").val(),
          'nasc': $("#nasc").val(),
          'cpf': $("#cpf").val(),
          'tel': $("#tel").val(),
          'email': $("#email").val(),
          'senha': $("#senha").val(),
        },
        success: alert("sucesso"),
      });
    });
  });
  